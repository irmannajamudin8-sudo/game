from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import os
from datetime import datetime, timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = 'supersecretkey123'
db_path = os.path.join(os.path.abspath(os.path.dirname(__name__)), 'database.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# ─── Models ───────────────────────────────────────────────────────────────────

class User(UserMixin, db.Model):
    id            = db.Column(db.Integer, primary_key=True)
    username      = db.Column(db.String(150), unique=True, nullable=False)
    email         = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(150), nullable=False)
    role          = db.Column(db.String(50),  nullable=False, default='user')
    is_online     = db.Column(db.Boolean, default=False)
    is_blocked    = db.Column(db.Boolean, default=False)
    last_seen     = db.Column(db.DateTime, default=datetime.utcnow)
    scores        = db.relationship('Score', backref='user', lazy=True)

    @property
    def is_currently_online(self):
        if not self.is_online or not self.last_seen:
            return False
        return datetime.utcnow() - self.last_seen < timedelta(minutes=5)

    @property
    def last_seen_formatted(self):
        if not self.last_seen:
            return "Never"
        diff    = datetime.utcnow() - self.last_seen
        seconds = diff.total_seconds()
        if seconds < 60:    return "Just now"
        minutes = int(seconds // 60)
        if minutes < 60:    return f"{minutes}m ago"
        hours = int(minutes // 60)
        if hours < 24:      return f"{hours}h ago"
        return f"{int(hours // 24)}d ago"

    @property
    def best_score(self):
        s = Score.query.filter_by(user_id=self.id).order_by(Score.score.desc()).first()
        return s.score if s else 0


class Score(db.Model):
    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    score      = db.Column(db.Integer, nullable=False, default=0)
    level      = db.Column(db.Integer, nullable=False, default=1)  # level reached
    deaths     = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def created_formatted(self):
        diff    = datetime.utcnow() - self.created_at
        seconds = diff.total_seconds()
        if seconds < 60:    return "Just now"
        minutes = int(seconds // 60)
        if minutes < 60:    return f"{minutes}m ago"
        hours = int(minutes // 60)
        if hours < 24:      return f"{hours}h ago"
        return f"{int(hours // 24)}d ago"


# ─── Loader & before_request ──────────────────────────────────────────────────

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

@app.before_request
def before_request():
    if current_user.is_authenticated:
        if getattr(current_user, 'is_blocked', False):
            logout_user()
            flash('Akun Anda telah diblokir karena aktivitas mencurigakan.', 'danger')
            return redirect(url_for('login'))
        current_user.last_seen = datetime.utcnow()
        current_user.is_online = True
        db.session.commit()

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('game'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('game'))
    if request.method == 'POST':
        email    = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        user     = User.query.filter_by(email=email).first()
        if not user:
            flash('Email belum terdaftar.', 'danger')
        elif getattr(user, 'is_blocked', False):
            flash('Akun Anda telah diblokir karena aktivitas mencurigakan.', 'danger')
        elif not check_password_hash(user.password_hash, password):
            flash('Password salah.', 'danger')
        else:
            login_user(user)
            user.is_online = True
            user.last_seen = datetime.utcnow()
            db.session.commit()
            return redirect(url_for('game'))
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('game'))
    if request.method == 'POST':
        username = request.form.get('username')
        email    = request.form.get('email', '').strip().lower()
        password = request.form.get('password')
        if not email or '@' not in email:
            flash('Invalid email address.', 'danger')
            return render_template('register.html')
        user_exists = User.query.filter(
            (User.username == username) | (User.email == email)).first()
        if user_exists:
            flash('Email atau username sudah terdaftar.', 'danger')
        else:
            is_first = User.query.count() == 0
            new_user = User(
                username=username, email=email,
                password_hash=generate_password_hash(password, method='pbkdf2:sha256'),
                role='admin' if is_first else 'user',
                is_online=True, last_seen=datetime.utcnow()
            )
            db.session.add(new_user)
            db.session.commit()
            flash('Registrasi berhasil! Silakan login.', 'success')
            return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    current_user.is_online = False
    db.session.commit()
    logout_user()
    return redirect(url_for('login'))

@app.route('/game')
@login_required
def game():
    return render_template('game.html')

# ─── Leaderboard ──────────────────────────────────────────────────────────────

@app.route('/leaderboard')
@login_required
def leaderboard():
    # Top 20 scores overall
    top_scores = (
        db.session.query(Score, User.username)
        .join(User, Score.user_id == User.id)
        .order_by(Score.score.desc())
        .limit(20)
        .all()
    )

    # Best score per user (for "all-time best" table)
    from sqlalchemy import func
    subq = (
        db.session.query(
            Score.user_id,
            func.max(Score.score).label('best')
        ).group_by(Score.user_id).subquery()
    )
    best_per_user = (
        db.session.query(User.username, subq.c.best, Score.level, Score.deaths, Score.created_at)
        .join(subq, User.id == subq.c.user_id)
        .join(Score, (Score.user_id == subq.c.user_id) & (Score.score == subq.c.best))
        .order_by(subq.c.best.desc())
        .limit(20)
        .all()
    )

    # My scores
    my_scores = (
        Score.query
        .filter_by(user_id=current_user.id)
        .order_by(Score.score.desc())
        .limit(10)
        .all()
    )

    return render_template('leaderboard.html',
                           top_scores=top_scores,
                           best_per_user=best_per_user,
                           my_scores=my_scores,
                           now=datetime.utcnow())

# ─── API: save score from JS ──────────────────────────────────────────────────

@app.route('/api/save_score', methods=['POST'])
@login_required
def save_score():
    data   = request.get_json()
    score  = int(data.get('score',  0))
    level  = int(data.get('level',  1))
    deaths = int(data.get('deaths', 0))

    # Anti-cheat detection
    if score > 10000 or level > 10:
        current_user.is_blocked = True
        db.session.commit()
        return jsonify({'status': 'error', 'message': 'Cheat detected. Account blocked.'}), 403

    entry = Score(user_id=current_user.id, score=score, level=level, deaths=deaths)
    db.session.add(entry)
    db.session.commit()
    return jsonify({'status': 'ok', 'score': score})

# ─── API: live leaderboard (top 5) for in-game overlay ────────────────────────

@app.route('/api/top_scores')
@login_required
def top_scores_api():
    from sqlalchemy import func
    subq = (
        db.session.query(
            Score.user_id,
            func.max(Score.score).label('best')
        ).group_by(Score.user_id).subquery()
    )
    rows = (
        db.session.query(User.username, subq.c.best)
        .join(subq, User.id == subq.c.user_id)
        .order_by(subq.c.best.desc())
        .limit(5)
        .all()
    )
    return jsonify([{'username': r.username, 'score': r.best} for r in rows])

# ─── Admin ────────────────────────────────────────────────────────────────────

@app.route('/admin')
@login_required
def admin():
    if current_user.role != 'admin':
        flash('Access denied: Admin only.', 'danger')
        return redirect(url_for('game'))
    users = User.query.all()
    return render_template('admin.html', users=users)

@app.route('/admin/delete/<int:user_id>', methods=['POST'])
@login_required
def delete_user(user_id):
    if current_user.role != 'admin':
        flash('Access denied.', 'danger')
        return redirect(url_for('game'))
    user_to_delete = db.session.get(User, user_id)
    if not user_to_delete:
        flash('User not found.', 'danger')
        return redirect(url_for('admin'))
    if user_to_delete.id == current_user.id:
        flash('You cannot delete yourself.', 'danger')
    else:
        db.session.delete(user_to_delete)
        db.session.commit()
        flash('User deleted successfully.', 'success')
    return redirect(url_for('admin'))

@app.route('/admin/toggle_block/<int:user_id>', methods=['POST'])
@login_required
def toggle_block(user_id):
    if current_user.role != 'admin':
        flash('Access denied.', 'danger')
        return redirect(url_for('game'))
    user_to_toggle = db.session.get(User, user_id)
    if not user_to_toggle:
        flash('User not found.', 'danger')
        return redirect(url_for('admin'))
    if user_to_toggle.id == current_user.id:
        flash('You cannot block yourself.', 'danger')
    else:
        user_to_toggle.is_blocked = not getattr(user_to_toggle, 'is_blocked', False)
        if user_to_toggle.is_blocked:
            user_to_toggle.is_online = False
        db.session.commit()
        action = 'blocked' if user_to_toggle.is_blocked else 'unblocked'
        flash(f'User {user_to_toggle.username} has been {action}.', 'success')
    return redirect(url_for('admin'))

# ─── Init ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
