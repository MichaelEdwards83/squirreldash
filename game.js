
// --- Utility Class (Pygame.Rect Equivalent) ---
class Rect {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
    }
    collides(other) {
        return this.x < other.x + other.width &&
            this.x + this.width > other.x &&
            this.y < other.y + other.height &&
            this.y + this.height > other.y;
    }
    get center() {
        return { x: this.x + this.width / 2, y: this.y + this.height / 2 };
    }
    set center({ x, y }) {
        this.x = x - this.width / 2;
        this.y = y - this.height / 2;
    }
    copy() {
        return new Rect(this.x, this.y, this.width, this.height);
    }
    set top_left(v) { this.x = v.x; this.y = v.y; }
}

// --- Squirrel Class ---
class Squirrel {
    constructor(x, y, tileSize, personality = 0) {
        this.tileSize = tileSize;
        this.uiBarHeight = 60;
        this.start_pos = { x: x, y: y };
        this.rect = new Rect(x, y, tileSize, tileSize);
        this.direction = 'up';
        this.target = this.rect.copy();
        this.vulnerable = false;

        // 0: Chaser, 1: Ambusher, 2: Sentinel, 3: Random
        this.personality = personality;

        this.direction_map = { 'up': { dr: -1, dc: 0 }, 'down': { dr: 1, dc: 0 }, 'left': { dr: 0, dc: -1 }, 'right': { dr: 0, dc: 1 } };
        this.opposites = { 'up': 'down', 'down': 'up', 'left': 'right', 'right': 'left' };

        // Settings
        this.normal_speed = 3.5; // Slightly slower than player (4) to be fair
        this.vulnerable_speed = 2;
    }

    // Determine the target coordinate based on personality and game state
    getLogicTarget(player_rect, player_direction, scatter_mode) {
        const p_col = Math.round(player_rect.x / this.tileSize);
        const p_row = Math.round((player_rect.y - this.uiBarHeight) / this.tileSize);

        // Scatter Logic
        if (scatter_mode && !this.vulnerable) {
            // Target specific corners
            if (this.personality === 0) return { col: 25, row: 0 }; // Top Right
            if (this.personality === 1) return { col: 0, row: 0 };  // Top Left
            if (this.personality === 2) return { col: 25, row: 29 }; // Bottom Right
            return { col: 0, row: 29 }; // Bottom Left (for Random/Other)
        }

        if (this.vulnerable) {
            return null; // Random panic
        }

        if (this.personality === 0) {
            // CHASER: Direct targeting but with mistakes
            // 20% chance to be confused (return null -> random move)
            if (Math.random() < 0.2) return null;
            return { col: p_col, row: p_row };
        }
        else if (this.personality === 1) {
            // AMBUSHER: Target 4 tiles ahead
            const { dr, dc } = this.direction_map[player_direction] || { dr: 0, dc: 0 };
            return { col: p_col + (dc * 4), row: p_row + (dr * 4) };
        }
        else if (this.personality === 2) {
            // SENTINEL: Reduced radius (8 -> 5)
            const s_col = Math.round(this.rect.x / this.tileSize);
            const s_row = Math.round((this.rect.y - this.uiBarHeight) / this.tileSize);
            const dist = Math.sqrt(Math.pow(s_col - p_col, 2) + Math.pow(s_row - p_row, 2));

            if (dist < 5) { // NERFED from 8
                return { col: p_col, row: p_row };
            } else {
                return { col: 1, row: 1 }; // Patrol Top-Left corner
            }
        }
        else {
            return null; // RANDOM
        }
    }
    

    

    move(wall_tiles, left_tunnel, right_tunnel, player_rect, player_direction, maze_dims, scatter_mode = false) {
        const current_speed = this.vulnerable ? this.vulnerable_speed : this.normal_speed;
        const target_center = this.target.center;
        const rect_center = this.rect.center;

        // Check if reached the current move target (center of tile)
        if (Math.abs(rect_center.x - target_center.x) < current_speed && Math.abs(rect_center.y - target_center.y) < current_speed) {
            this.rect.center = target_center;

            const current_col = Math.round(this.rect.x / this.tileSize);
            const current_row = Math.round((this.rect.y - this.uiBarHeight) / this.tileSize);

            // Find valid directions
            let valid_directions = [];
            for (const [d, { dr, dc }] of Object.entries(this.direction_map)) {
                if (!wall_tiles.has(`${current_row + dr},${current_col + dc}`)) {
                    valid_directions.push(d);
                }
            }

            if (valid_directions.length === 0) return; // Trapped

            // Prevent reversing direction unless dead end
            if (valid_directions.length > 1 && valid_directions.includes(this.opposites[this.direction])) {
                valid_directions = valid_directions.filter(d => d !== this.opposites[this.direction]);
            }

            // AI Decision Making
            const logicTarget = this.getLogicTarget(player_rect, player_direction, scatter_mode);

            if (logicTarget && valid_directions.length > 1) {
                // Choose direction that minimizes distance to logicTarget
                let best_dir = valid_directions[0];
                let min_dist = Infinity;

                for (const d of valid_directions) {
                    const { dr, dc } = this.direction_map[d];
                    const next_col = current_col + dc;
                    const next_row = current_row + dr;

                    // Simple Euclidean distance squared
                    const dist = Math.pow(next_col - logicTarget.col, 2) + Math.pow(next_row - logicTarget.row, 2);

                    if (dist < min_dist) {
                        min_dist = dist;
                        best_dir = d;
                    }
                }
                this.direction = best_dir;
            } else {
                // Random choice (for personality 3, vulnerable state, or tie-breakers)
                this.direction = valid_directions[Math.floor(Math.random() * valid_directions.length)];
            }

            // Set physics target based on chosen direction
            const { dr, dc } = this.direction_map[this.direction];
            this.target.x = (current_col + dc) * this.tileSize;
            this.target.y = ((current_row + dr) * this.tileSize) + this.uiBarHeight;
        }

        // Move towards physics target
        if (this.rect.y > this.target.y) this.rect.y = Math.max(this.target.y, this.rect.y - current_speed);
        else if (this.rect.y < this.target.y) this.rect.y = Math.min(this.target.y, this.rect.y + current_speed);
        else if (this.rect.x > this.target.x) this.rect.x = Math.max(this.target.x, this.rect.x - current_speed);
        else if (this.rect.x < this.target.x) this.rect.x = Math.min(this.target.x, this.rect.x + current_speed);

        // Tunnel Check
        if (left_tunnel && this.rect.collides(left_tunnel)) {
            this.rect.x = right_tunnel.x - this.tileSize;
            this.target = this.rect.copy();
        } else if (right_tunnel && this.rect.collides(right_tunnel)) {
            this.rect.x = left_tunnel.x + this.tileSize;
            this.target = this.rect.copy();
        }
    }


    reverseDirection() {
        this.direction = this.opposites[this.direction];
    }

    draw(ctx, assets) {
        const img = this.vulnerable ? assets.squirrel_vulnerable : assets.squirrel_normal;
        if (img && img.width > 0) {
            ctx.drawImage(img, this.rect.x, this.rect.y, this.rect.width, this.rect.height);
        } else {
            // Fallback
            ctx.fillStyle = this.vulnerable ? '#0000FF' : '#FF0000'; // Blue if vulnerable, Red otherwise
            ctx.fillRect(this.rect.x + 4, this.rect.y + 4, this.rect.width - 8, this.rect.height - 8);
        }
    }
}

// --- Sound Manager ---
class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
    }

    playTone(freq, type, duration, startTime = 0) {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + startTime);
        osc.stop(this.ctx.currentTime + startTime + duration);
    }

    playChomp() {
        // Waka waka sound - two alternating tones
        this.playTone(300, 'triangle', 0.1);
        setTimeout(() => this.playTone(450, 'triangle', 0.1), 100);
    }

    playEatGhost() {
        // High pitched satisfying zap
        this.playTone(800, 'square', 0.1);
        setTimeout(() => this.playTone(1200, 'square', 0.1), 50);
    }

    playDie() {
        // Engineering failure / Sad trombone-ish
        this.playTone(300, 'sawtooth', 0.2);
        setTimeout(() => this.playTone(250, 'sawtooth', 0.2), 200);
        setTimeout(() => this.playTone(200, 'sawtooth', 0.4), 400);
    }

    playWin() {
        // Victory fanfare
        const now = this.ctx.currentTime;
        this.playTone(523.25, 'square', 0.1, 0); // C5
        this.playTone(659.25, 'square', 0.1, 0.1); // E5
        this.playTone(783.99, 'square', 0.1, 0.2); // G5
        this.playTone(1046.50, 'square', 0.4, 0.3); // C6
    }
}

class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) throw new Error("Canvas element not found!");
        this.ctx = this.canvas.getContext('2d');

        // Audio
        this.sound = new SoundManager();

        // Constants
        this.TILE_SIZE = 36;
        this.UI_BAR_HEIGHT = 60;
        this.PLAYER_SPEED = 4;
        this.POWERUP_DURATION = 300;
        this.FPS = 30;
        this.FRAME_DURATION = 1000 / this.FPS;

        // Level Layout

        // Level Layouts
        this.levels = [
            // Level 1: The Original
            [
                "WWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                "W............WW............W",
                "W.WWWW.WWWWW.WW.WWWWW.WWWW.W",
                "W O  W.W   W.WW.W   W.W  O W",
                "W.WWWW.WWWWW.WW.WWWWW.WWWW.W",
                "W..........................W",
                "W.WWWW.WW.WWWWWWWW.WW.WWWW.W",
                "W.WWWW.WW.WWWWWWWW.WW.WWWW.W",
                "W......WW....WW....WW......W",
                "WWWWWW.WWWWW WW WWWWW.WWWWWW",
                "WWWWWW.WWWWW WW WWWWW.WWWWWW",
                "WWWWWW.WW  GGGGGG  WW.WWWWWW",
                "WWWWWW.WW WWWWWWWW WW.WWWWWW",
                "WWWWWW.WW W------W WW.WWWWWW",
                "L      .  W------W  .      R",
                "WWWWWW.WW W------W WW.WWWWWW",
                "WWWWWW.WW WWWWWWWW WW.WWWWWW",
                "WWWWWW.WW          WW.WWWWWW",
                "WWWWWW.WW WWWWWWWW WW.WWWWWW",
                "WWWWWW.WW WWWWWWWW WW.WWWWWW",
                "W............WW............W",
                "W.WWWW.WWWWW.WW.WWWWW.WWWW.W",
                "W.WWWW.WWWWW.WW.WWWWW.WWWW.W",
                "W O..W.......P........W..O W",
                "WWW.WW.WW.WWWWWWWW.WW.WW.WWW",
                "WWW.WW.WW.WWWWWWWW.WW.WW.WWW",
                "W......WW....WW....WW......W",
                "W.WWWWWWWWWW.WW.WWWWWWWWWW.W",
                "W.WWWWWWWWWW.WW.WWWWWWWWWW.W",
                "W..........................W",
                "WWWWWWWWWWWWWWWWWWWWWWWWWWWW"
            ],
            // Level 2: The Gardens (More Open)
            [
                "WWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                "W............WW............W",
                "W.WWWWWWWWWW.WW.WWWWWWWWWW.W",
                "W.O......................O.W",
                "W.WW.WWWWWW.WWWW.WWWWWW.WW.W",
                "W....W....W.W..W.W....W....W",
                "WWWW.W.WW.W.W..W.W.WW.W.WWWW",
                "W....W.WW.W.W..W.W.WW.W....W",
                "W.WWWW....W......W....WWWW.W",
                "W......WW.WW GG WW.WW......W",
                "WWWWWW.WW.WW GG WW.WW.WWWWWW",
                "WWWWWW.WW.WW GG WW.WW.WWWWWW",
                "W......WW.WWWWWWWW.WW......W",
                "W.WWWW.......--.......WWWW.W",
                "L.WWWW.WWWWW.--.WWWWW.WWWW.R",
                "W......W.....--.....W......W",
                "WWWWWW.W.WWWWWWWWWW.W.WWWWWW",
                "W......W.W........W.W......W",
                "W.WWWW.W.W.WWWWWW.W.W.WWWW.W",
                "W.W....W.W.W....W.W.W....W.W",
                "W.W.WW.W.W.W.WW.W.W.W.WW.W.W",
                "W.W.WW.......P........WW.W.W",
                "W.W.WW.WWWWWWWWWWWWWW.WW.W.W",
                "W.O....W.....WW.....W....O.W",
                "WWWWWW.W.WW.WWWW.WW.W.WWWWWW",
                "W......W.WW.WWWW.WW.W......W",
                "W.WWWWWW.WW......WW.WWWWWW.W",
                "W............WW............W",
                "WWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                "WWWWWWWWWWWWWWWWWWWWWWWWWWWW"
            ],
            // Level 3: The Thicket (Dense)
            [
                "WWWWWWWWWWWWWWWWWWWWWWWWWWWW",
                "W.WW...W...W..W...W...WW...W",
                "W.WW.W.W.W.W.WW.W.W.W.WW.W.W",
                "W.O..W...W...WW...W...W..O.W",
                "WW.WWWWW.WWWWWWWWWWWW.WWWWW.WW",
                "W..W.........WW.........W..W",
                "W.WW.WWWWWWW.WW.WWWWWWW.WW.W",
                "W....W.......WW.......W....W",
                "WWWW.W.WWWWW.WW.WWWWW.W.WWWW",
                "W....W.W  W..GG..W  W.W....W",
                "W.WWWW.W  W..GG..W  W.WWWW.W",
                "W.W....WWWW..GG..WWWW....W.W",
                "W.W.WW.......--.......WW.W.W",
                "L...WW.WWWWW.--.WWWWW.WW...R",
                "WW.WWW.W.....--.....W.WWW.WW",
                "W..W...W.WWWWWWWWWW.W...W..W",
                "W.WW.W.W.W........W.W.W.WW.W",
                "W....W.W.W.WWWWWW.W.W.W....W",
                "WWWW.W.W.W.W....W.W.W.W.WWWW",
                "W....W...W.W.WW.W.W...W....W",
                "W.WWWWWWWW.W.WW.W.WWWWWWWW.W",
                "W..........W.P..W..........W",
                "WWWW.WWWWWWW.WW.WWWWWWW.WWWW",
                "W.O..W.......WW.......W..O.W",
                "W.WW.W.WWWWWWWWWWWWWW.W.WW.W",
                "W.WW.W.......WW.......W.WW.W",
                "W....WWWWWWW.WW.WWWWWWW....W",
                "W.WW.........WW.........WW.W",
                "W....WWWWWWWWWWWWWWWWWW....W",
                "WWWWWWWWWWWWWWWWWWWWWWWWWWWW"
            ]
        ];
        this.current_level_index = 0;
        this.maze_layout = this.levels[this.current_level_index];


        this.MAZE_ROWS = this.maze_layout.length;
        this.MAZE_COLS = this.maze_layout[0].length;
        this.SCREEN_WIDTH = this.MAZE_COLS * this.TILE_SIZE;
        this.SCREEN_HEIGHT = (this.MAZE_ROWS * this.TILE_SIZE) + this.UI_BAR_HEIGHT;

        // Set canvas size
        this.canvas.width = this.SCREEN_WIDTH;
        this.canvas.height = this.SCREEN_HEIGHT;

        // Game State
        this.state = 'loading'; // loading, start, playing, won, game_over
        this.score = 0;
        this.lives = 3;
        this.powerup_timer = 0;
        this.scatter_mode = false;
        this.mode_timer = 0;
        this.SCATTER_DURATION = 200; // ~7 seconds
        this.CHASE_DURATION = 600; // ~20 seconds
    
        this.generateWallLines();
        this.last_frame_time = performance.now();
        this.assets = {};
        this.player_images = {};

        // Entities
        this.wall_rects = [];
        this.wall_tiles = new Set();
        this.acorn_rects = [];
        this.squirrels = [];
        this.player_start_pos = { x: 0, y: 0 };
        this.left_tunnel_rect = null;
        this.right_tunnel_rect = null;
        this.player_rect = null;
        this.player_target = null;

        // Movement State
        this.player_direction = 'right';
        this.pending_direction = 'right';
        this.keys_pressed = {}; // not strictly used but good for extensions

        // Bind methods
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.gameLoop = this.gameLoop.bind(this);
        this.resize = this.resize.bind(this);
    }

    async init() {
        // Load assets
        try {
            const assetPathsMap = window.ASSET_PATHS || {};
            const loadPromises = Object.entries(assetPathsMap).map(([key, dataUrl]) => {
                return this.loadImage(key, dataUrl);
            });
            await Promise.all(loadPromises);

            this.setupPlayerImages();
            this.state = 'start';
            this.setupLevel();

            // Start Loop
            window.addEventListener('keydown', this.handleKeyDown);
            window.addEventListener('keyup', this.handleKeyUp);
            window.addEventListener('resize', this.resize);

            this.resize(); // Initial resize
            requestAnimationFrame(this.gameLoop);

        } catch (error) {
            console.error("Initialization failed:", error);
            this.state = 'error';
            this.draw(); // Draw error screen
        }
    }

    loadImage(name, dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.assets[name] = img;
                resolve(img);
            };
            img.onerror = () => reject(`Failed to load ${name}`);
            img.src = dataUrl;
        });
    }

    transformImage(img, rotation, flipX) {
        const scale = 1.4;
        const w = this.TILE_SIZE * scale;
        const h = this.TILE_SIZE * scale;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const c = canvas.getContext('2d');

        c.translate(w / 2, h / 2);
        if (flipX) c.scale(-1, 1);
        if (rotation !== 0) {
            c.rotate(rotation * Math.PI / 180);
        }
        c.drawImage(img, -w / 2, -h / 2, w, h);
        return canvas;
    }

    setupPlayerImages() {
        const img = this.assets.player_orig;
        if (!img) return;

        this.player_images = {
            'right': this.transformImage(img, 0, false),
            'left': this.transformImage(img, 0, true),
            'up': this.transformImage(img, -90, false),
            'down': this.transformImage(img, 90, false),
        };

        const life_canvas = document.createElement('canvas');
        life_canvas.width = this.TILE_SIZE;
        life_canvas.height = this.TILE_SIZE;
        life_canvas.getContext('2d').drawImage(img, 0, 0, this.TILE_SIZE, this.TILE_SIZE);
        this.assets.life_icon = life_canvas;
    }

    setupLevel() {
        this.maze_layout = this.levels[this.current_level_index];
        this.MAZE_ROWS = this.maze_layout.length;
        this.MAZE_COLS = this.maze_layout[0].length;

        this.wall_rects = [];
        this.wall_tiles = new Set();
        this.acorn_rects = [];
        this.squirrels = [];
        this.player_start_pos = { x: 0, y: 0 };
        this.left_tunnel_rect = null;
        this.right_tunnel_rect = null;

        for (let r = 0; r < this.MAZE_ROWS; r++) {
            for (let c = 0; c < this.MAZE_COLS; c++) {
                const char = this.maze_layout[r][c];
                const x = c * this.TILE_SIZE;
                const y = (r * this.TILE_SIZE) + this.UI_BAR_HEIGHT;

                if (char === 'W' || char === '-') {
                    this.wall_rects.push(new Rect(x, y, this.TILE_SIZE, this.TILE_SIZE));
                    this.wall_tiles.add(`${r},${c}`);
                } else if (char === 'G') {
                    // Assign personality based on index: 0=Chaser, 1=Ambusher, 2=Sentinel, 3=Random
                    const personality = this.squirrels.length % 4;
                    this.squirrels.push(new Squirrel(x, y, this.TILE_SIZE, personality));
                } else if (char === 'P') {
                    this.player_start_pos = { x: x, y: y };
                } else if (char === 'L') {
                    this.left_tunnel_rect = new Rect(x, y, this.TILE_SIZE, this.TILE_SIZE);
                } else if (char === 'R') {
                    this.right_tunnel_rect = new Rect(x, y, this.TILE_SIZE, this.TILE_SIZE);
                } else if (char === '.') {
                    const acorn_size = this.TILE_SIZE / 2;
                    this.acorn_rects.push({
                        rect: new Rect(x + (this.TILE_SIZE - acorn_size) / 2, y + (this.TILE_SIZE - acorn_size) / 2, acorn_size, acorn_size),
                        type: '.'
                    });
                } else if (char === 'O') {
                    const large_acorn_size = this.TILE_SIZE * 0.8;
                    this.acorn_rects.push({
                        rect: new Rect(x + (this.TILE_SIZE - large_acorn_size) / 2, y + (this.TILE_SIZE - large_acorn_size) / 2, large_acorn_size, large_acorn_size),
                        type: 'O'
                    });
                }
            }
        }

        // Reset Player
        if (!this.player_rect) {
            this.player_rect = new Rect(this.player_start_pos.x, this.player_start_pos.y, this.TILE_SIZE, this.TILE_SIZE);
        } else {
            this.player_rect.top_left = this.player_start_pos;
        }

        this.player_target = this.player_rect.copy();
        this.player_direction = 'right';
        this.pending_direction = 'right';

        // Reset variables but keep score if playing
        if (this.state !== 'playing') {
            this.score = 0;
            this.lives = 3;
        }
        this.powerup_timer = 0;
        this.scatter_mode = false;
        this.mode_timer = 0;
        this.SCATTER_DURATION = 200; // ~7 seconds
        this.CHASE_DURATION = 600; // ~20 seconds
    
        this.generateWallLines();
    }

    handleKeyDown(e) {
        console.log(`Key pressed: ${e.key}, State: ${this.state}`);
        this.keys_pressed[e.key] = true;
        let direction_set = true;

        if (['ArrowLeft', 'a'].includes(e.key)) this.pending_direction = 'left';
        else if (['ArrowRight', 'd'].includes(e.key)) this.pending_direction = 'right';
        else if (['ArrowUp', 'w'].includes(e.key)) this.pending_direction = 'up';
        else if (['ArrowDown', 's'].includes(e.key)) this.pending_direction = 'down';
        else direction_set = false;

        if (direction_set) {
            e.preventDefault();
            // Resume Audio Context if suspended (browser policy)
            if (this.sound.ctx.state === 'suspended') {
                this.sound.ctx.resume();
            }
            console.log(`Pending Direction set to: ${this.pending_direction}`);
        }

        // State Transitions
        if (['start', 'won', 'game_over'].includes(this.state)) {
            if (this.state !== 'start') {
                // If restarting from win/loss, reset score completely
                if (this.state === 'won' || this.state === 'game_over') {
                    this.score = 0;
                    this.lives = 3;
                }
                this.setupLevel(); window.game_instance = this;
            }
            this.state = 'playing';

            // Resume Audio on start
            if (this.sound.ctx.state === 'suspended') {
                this.sound.ctx.resume();
            }
            console.log("Game State changed to: playing");
        }
    }

    handleKeyUp(e) {
        this.keys_pressed[e.key] = false;
    }

    update() {
        if (this.state !== 'playing') return;

        if (this.powerup_timer > 0) {
            this.powerup_timer--;
            if (this.powerup_timer === 0) {
                this.squirrels.forEach(s => s.vulnerable = false);
            }
        }

        this.movePlayer();

        for (const squirrel of this.squirrels) {
            squirrel.move(
                this.wall_tiles,
                this.left_tunnel_rect,
                this.right_tunnel_rect,
                this.player_rect,
                this.player_direction,
                { rows: this.MAZE_ROWS, cols: this.MAZE_COLS },
                this.scatter_mode
            );
        }

        this.checkCollisions();
    }

    isPlayerAligned() {
        const center = this.player_rect.center;
        const col_center_x = Math.floor(center.x / this.TILE_SIZE) * this.TILE_SIZE + this.TILE_SIZE / 2;
        const row_center_y = Math.floor((center.y - this.UI_BAR_HEIGHT) / this.TILE_SIZE) * this.TILE_SIZE + this.TILE_SIZE / 2 + this.UI_BAR_HEIGHT;
        const tolerance = this.PLAYER_SPEED / 2;

        return Math.abs(center.x - col_center_x) < tolerance && Math.abs(center.y - row_center_y) < tolerance;
    }

    movePlayer() {
        const is_aligned = this.isPlayerAligned();
        const player_center = this.player_rect.center;
        const target_center = this.player_target.center;
        const dir_map = { 'up': { dr: -1, dc: 0 }, 'down': { dr: 1, dc: 0 }, 'left': { dr: 0, dc: -1 }, 'right': { dr: 0, dc: 1 } };
        let attempt_direction = null;

        const reached_target = Math.abs(player_center.x - target_center.x) < this.PLAYER_SPEED &&
            Math.abs(player_center.y - target_center.y) < this.PLAYER_SPEED;

        if (reached_target) {
            this.player_rect.center = target_center;
        }

        if (is_aligned && this.player_direction !== this.pending_direction) {
            attempt_direction = this.pending_direction;
        } else if (reached_target) {
            attempt_direction = this.player_direction;
        }

        if (attempt_direction) {
            const current_col = Math.round(this.player_rect.x / this.TILE_SIZE);
            const current_row = Math.round((this.player_rect.y - this.UI_BAR_HEIGHT) / this.TILE_SIZE);
            const { dr, dc } = dir_map[attempt_direction];
            const next_tile_key = `${current_row + dr},${current_col + dc}`;

            if (!this.wall_tiles.has(next_tile_key)) {
                this.player_direction = attempt_direction;
                this.player_target.x = (current_col + dc) * this.TILE_SIZE;
                this.player_target.y = ((current_row + dr) * this.TILE_SIZE) + this.UI_BAR_HEIGHT;
            }
        }

        // Move rect
        const dx = this.player_target.center.x - this.player_rect.center.x;
        const dy = this.player_target.center.y - this.player_rect.center.y;

        if (Math.abs(dx) > 0) this.player_rect.x += Math.sign(dx) * Math.min(Math.abs(dx), this.PLAYER_SPEED);
        if (Math.abs(dy) > 0) this.player_rect.y += Math.sign(dy) * Math.min(Math.abs(dy), this.PLAYER_SPEED);

        // Tunnel
        if (this.left_tunnel_rect && this.player_rect.collides(this.left_tunnel_rect)) {
            this.player_rect.x = this.right_tunnel_rect.x - this.TILE_SIZE;
            this.player_target = this.player_rect.copy();
        } else if (this.right_tunnel_rect && this.player_rect.collides(this.right_tunnel_rect)) {
            this.player_rect.x = this.left_tunnel_rect.x + this.TILE_SIZE;
            this.player_target = this.player_rect.copy();
        }
    }

    checkCollisions() {
        // Acorns
        const remaining_acorns = [];
        for (const acorn of this.acorn_rects) {
            if (this.player_rect.collides(acorn.rect)) {
                this.score += (acorn.type === 'O') ? 50 : 10;
                this.sound.playChomp();
                if (acorn.type === 'O') {
                    this.powerup_timer = this.POWERUP_DURATION;
                    this.squirrels.forEach(s => s.vulnerable = true);
                }
            } else {
                remaining_acorns.push(acorn);
            }
        }
        this.acorn_rects = remaining_acorns;

        if (this.acorn_rects.length === 0) {
            this.current_level_index++;
            if (this.current_level_index < this.levels.length) {
                this.sound.playWin(); // Maybe a shorter level complete sound?
                // Reset for next level
                this.setupLevel(); window.game_instance = this;
                // Need to re-bind wall lines for new level
                // setupLevel calls generateWallLines so that is covered.
            } else {
                this.state = 'won';
                this.sound.playWin();
            }
        }

        // Squirrels
        for (const squirrel of this.squirrels) {
            if (this.player_rect.collides(squirrel.rect)) {
                if (squirrel.vulnerable) {
                    // Eat Squirrel
                    this.score += 200;
                    this.sound.playEatGhost();
                    squirrel.rect.x = squirrel.start_pos.x;
                    squirrel.rect.y = squirrel.start_pos.y;
                    squirrel.target = squirrel.rect.copy();
                    squirrel.vulnerable = false;
                } else {
                    // Player Die
                    this.lives--;
                    this.sound.playDie();
                    if (this.lives > 0) {
                        this.player_rect.top_left = this.player_start_pos;
                        this.player_target = this.player_rect.copy();
                        this.player_direction = 'right';
                        this.pending_direction = 'right';

                        // Reset squirrels to start positions to prevent spawn-kill
                        this.squirrels.forEach(s => {
                            s.rect.x = s.start_pos.x;
                            s.rect.y = s.start_pos.y;
                            s.target = s.rect.copy();
                        });
                    } else {
                        this.state = 'game_over';
                    }
                }
            }
        }
    }

    resize() {
        const container = document.getElementById('game-container');
        if (!container) return;

        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const gameWidth = this.SCREEN_WIDTH;
        const gameHeight = this.SCREEN_HEIGHT;
        const padding = 20;

        const scaleX = (windowWidth - padding) / gameWidth;
        const scaleY = (windowHeight - padding) / gameHeight;
        const scale = Math.min(scaleX, scaleY);

        container.style.transform = `scale(${scale})`;
        container.style.width = `${gameWidth}px`;
        container.style.height = `${gameHeight}px`;
    }


    generateWallLines() {
        this.wall_lines = [];
        const rows = this.maze_layout.length;
        const cols = this.maze_layout[0].length;
        const T = this.TILE_SIZE;
        const OFFSET_Y = this.UI_BAR_HEIGHT;

        const isWall = (r, c) => {
            if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
            const char = this.maze_layout[r][c];
            return char === 'W' || char === '-';
        };

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!isWall(r, c)) continue;

                const x = c * T;
                const y = (r * T) + OFFSET_Y;

                // Check neighbors and add lines for exposed edges
                if (!isWall(r - 1, c)) this.wall_lines.push({ x1: x, y1: y, x2: x + T, y2: y });         // Top
                if (!isWall(r + 1, c)) this.wall_lines.push({ x1: x, y1: y + T, x2: x + T, y2: y + T }); // Bottom
                if (!isWall(r, c - 1)) this.wall_lines.push({ x1: x, y1: y, x2: x, y2: y + T });         // Left
                if (!isWall(r, c + 1)) this.wall_lines.push({ x1: x + T, y1: y, x2: x + T, y2: y + T }); // Right
            }
        }
    }

    draw() {
        const c = this.ctx;

        // --- Background (Classic Black) ---
        c.fillStyle = '#000000';
        c.fillRect(0, 0, this.SCREEN_WIDTH, this.SCREEN_HEIGHT);

        if (this.state === 'loading') {
            c.fillStyle = '#ffffff'; c.font = '24px "Courier New", monospace';
            c.textAlign = 'center'; c.fillText('LOADING...', this.SCREEN_WIDTH / 2, this.SCREEN_HEIGHT / 2);
            return;
        }
        if (this.state === 'error') {
            c.fillStyle = '#ff0000'; c.font = '24px "Courier New", monospace';
            c.textAlign = 'center'; c.fillText('ERROR', this.SCREEN_WIDTH / 2, this.SCREEN_HEIGHT / 2);
            return;
        }
        if (this.state === 'start') {
            if (this.assets.start_screen) {
                c.drawImage(this.assets.start_screen, 0, 0, this.SCREEN_WIDTH, this.SCREEN_HEIGHT);
            }
            // Blinking Text
            if (Math.floor(Date.now() / 500) % 2 === 0) {
                c.font = 'bold 24px "Courier New", monospace';
                c.fillStyle = '#FFFF00';
                c.textAlign = 'center';
                c.fillText('PRESS ENTER', this.SCREEN_WIDTH / 2, this.SCREEN_HEIGHT - 80);
            }
            return;
        }

        // --- Walls (Classic Blue Outlines) ---
        c.save();
        c.strokeStyle = '#2121ff'; // Classic Arcade Blue
        c.lineWidth = 2; // Thin crisp lines
        c.shadowBlur = 0; // No glow, keep it crisp

        c.beginPath();
        for (const line of this.wall_lines) {
            c.moveTo(line.x1, line.y1);
            c.lineTo(line.x2, line.y2);
        }
        c.stroke();
        c.restore();

        // --- Tunnels ---
        c.fillStyle = '#000000';
        if (this.left_tunnel_rect) c.fillRect(this.left_tunnel_rect.x, this.left_tunnel_rect.y, this.left_tunnel_rect.width, this.left_tunnel_rect.height);
        if (this.right_tunnel_rect) c.fillRect(this.right_tunnel_rect.x, this.right_tunnel_rect.y, this.right_tunnel_rect.width, this.right_tunnel_rect.height);

        // --- Items (Acorns) ---
        const acorn_img = this.assets.acorn;

        for (const acorn of this.acorn_rects) {
            const cx = acorn.rect.center.x;
            const cy = acorn.rect.center.y;

            if (acorn.type === 'O') {
                // Power Pellet: Larger, blinks
                const blink = Math.floor(Date.now() / 200) % 2 === 0;

                if (blink) {
                    c.save();
                    c.translate(cx, cy);
                    c.scale(1.2, 1.2);
                    if (acorn_img && acorn_img.width > 0) {
                        c.drawImage(acorn_img, -acorn.rect.width / 2, -acorn.rect.height / 2, acorn.rect.width, acorn.rect.height);
                    } else {
                        c.fillStyle = '#ffb8ae';
                        c.beginPath(); c.arc(0, 0, 8, 0, Math.PI * 2); c.fill();
                    }
                    c.restore();
                }

            } else {
                // Normal Acorn
                c.save();
                c.translate(cx, cy);

                if (acorn_img && acorn_img.width > 0) {
                    c.drawImage(acorn_img, -acorn.rect.width / 2, -acorn.rect.height / 2, acorn.rect.width, acorn.rect.height);
                } else {
                    c.fillStyle = '#ffb8ae'; // Salmon
                    c.beginPath(); c.fillRect(-2, -2, 4, 4); // Square dot
                }
                c.restore();
            }
        }

        // --- Player ---
        if (this.player_rect) {
            c.save();
            const cx = this.player_rect.center.x;
            const cy = this.player_rect.center.y;
            c.translate(cx, cy);

            let rotation = 0;
            let flipX = false;
            if (this.player_direction === 'up') rotation = -90;
            if (this.player_direction === 'down') rotation = 90;
            if (this.player_direction === 'left') flipX = true;

            const sprite = this.player_images[this.player_direction];

            if (sprite) {
                c.drawImage(sprite, -this.TILE_SIZE / 1.4, -this.TILE_SIZE / 1.4, this.TILE_SIZE * 1.4, this.TILE_SIZE * 1.4);
            } else if (this.assets.player_orig) {
                if (flipX) c.scale(-1, 1);
                c.rotate(rotation * Math.PI / 180);
                c.drawImage(this.assets.player_orig, -this.TILE_SIZE / 1.4, -this.TILE_SIZE / 1.4, this.TILE_SIZE * 1.4, this.TILE_SIZE * 1.4);
            } else {
                c.fillStyle = '#FFFF00';
                c.beginPath(); c.arc(0, 0, this.TILE_SIZE / 2 - 2, 0, Math.PI * 2); c.fill();
            }
            c.restore();
        }

        // --- Squirrels ---
        this.squirrels.forEach(s => s.draw(c, this.assets));

        // --- UI Bar ---
        c.fillStyle = '#000000';
        c.fillRect(0, 0, this.SCREEN_WIDTH, this.UI_BAR_HEIGHT);

        c.fillStyle = '#FFFFFF';
        c.font = 'bold 20px "Courier New", monospace';
        c.textAlign = 'left';

        c.fillText(`SCORE`, 20, 25);
        c.textAlign = 'right';
        c.fillText(`LIVES`, this.SCREEN_WIDTH - 20, 25);

        c.fillStyle = '#FFFF00';
        c.textAlign = 'left';
        c.fillText(`${this.score}`, 20, 45);

        c.textAlign = 'right';
        if (this.assets.life_icon) {
            for (let i = 0; i < this.lives; i++) {
                c.drawImage(this.assets.life_icon, this.SCREEN_WIDTH - 20 - ((i + 1) * 30), 28, 24, 24);
            }
        } else {
            c.fillText(`${this.lives}`, this.SCREEN_WIDTH - 20, 45);
        }

        if (this.powerup_timer > 0) {
            const time_left = Math.ceil(this.powerup_timer / 30);
            c.fillStyle = '#2121ff'; c.textAlign = 'center';
            c.fillText(`POWER: ${time_left}`, this.SCREEN_WIDTH / 2, 38);
        }

        // --- Overlays ---
        if (this.state === 'game_over') {
            c.save();
            c.fillStyle = 'rgba(0,0,0,0.8)';
            c.fillRect(0, 0, this.SCREEN_WIDTH, this.SCREEN_HEIGHT);

            c.fillStyle = '#FF0000';
            c.font = 'bold 40px "Courier New", monospace';
            c.textAlign = 'center';
            c.fillText('GAME  OVER', this.SCREEN_WIDTH / 2, this.SCREEN_HEIGHT / 2);
            c.restore();

            c.fillStyle = '#ffffff';
            c.font = '20px "Courier New", monospace';
            c.textAlign = 'center';
            c.fillText('PRESS ENTER', this.SCREEN_WIDTH / 2, this.SCREEN_HEIGHT / 2 + 60);
        }
        else if (this.state === 'won') {
            c.fillStyle = 'rgba(0,0,0,0.8)';
            c.fillRect(0, 0, this.SCREEN_WIDTH, this.SCREEN_HEIGHT);

            c.fillStyle = '#00FF00';
            c.font = 'bold 40px "Courier New", monospace';
            c.textAlign = 'center';
            c.fillText('YOU WIN!', this.SCREEN_WIDTH / 2, this.SCREEN_HEIGHT / 2);

            c.fillStyle = '#ffffff';
            c.font = '20px "Courier New", monospace';
            c.fillText('SCORE: ' + this.score, this.SCREEN_WIDTH / 2, this.SCREEN_HEIGHT / 2 + 50);
            c.fillText('PRESS ENTER', this.SCREEN_WIDTH / 2, this.SCREEN_HEIGHT / 2 + 90);
        }
    }


    gameLoop(timestamp) {
        if (this.state === 'loading' || this.state === 'error') {
            this.draw();
            requestAnimationFrame(this.gameLoop);
            return;
        }

        const elapsed = timestamp - this.last_frame_time;
        if (elapsed > this.FRAME_DURATION) {
            this.last_frame_time = timestamp - (elapsed % this.FRAME_DURATION);
            this.update();
            this.draw();
        }
        requestAnimationFrame(this.gameLoop);
    }
}

// Start Game
window.onload = () => {
    const game = new Game('gameCanvas');
    game.init();
};
