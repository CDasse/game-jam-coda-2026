import * as Phaser from 'phaser';

export class Game extends Phaser.Scene
{
    private player: Phaser.Physics.Arcade.Sprite;
    private stars: Phaser.Physics.Arcade.Group;
    private bombs: Phaser.Physics.Arcade.Group;
    private platforms: Phaser.Physics.Arcade.Group;
    private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    private scoreText: Phaser.GameObjects.Text;
    private gameOverText: Phaser.GameObjects.Text;
    private score = 0;
    private gameOver = false;
    private canDoubleJump = true;
    private canDash= true;
    private platformVelocity = 0;
    private isDropping = false;
    private gameStarted = false;
    private startScreen: Phaser.GameObjects.Container;

    constructor ()
    {
        super('Game');
    }

    preload ()
    {
        this.load.setPath('assets');
        this.load.image('background', 'bg.png');
        this.load.image('ground', 'green-platform.png');
        this.load.image('moving-ground', 'ice-platform.png');
        this.load.image('star', 'star.png');
        this.load.image('bomb', 'bomb.png');
        this.load.spritesheet('dude', 'dude.png', { frameWidth: 32, frameHeight: 48 });
    }

    create ()
    {
        this.add.image(0, 0, 'background').setOrigin(0).setDisplaySize(1024, 768);

        this.platforms = this.physics.add.group();

        const createPlatform = (x: number, y: number, key: string, vx: number, scale = 1) => {
            const p = this.platforms.create(x, y, key) as Phaser.Physics.Arcade.Sprite;
            p.setImmovable(true);

            (p.body as Phaser.Physics.Arcade.Body).allowGravity = false;

            p.setVelocityX(vx);
            if (scale !== 1) p.setScale(scale);
            return p;
        };

        createPlatform(400, 930, 'ground', 0, 4);
        createPlatform(850, 600, 'ground', 0, 0.8);
        createPlatform(200, 400, 'ground', 0, 0.8);
        createPlatform(750, 220, 'ground', 0, 0.8);

        const myMovingPlatform = createPlatform(400, 500, 'moving-ground', -100, 0.5);
        myMovingPlatform.setCollideWorldBounds(true);
        myMovingPlatform.setBounceX(1);

        this.player = this.physics.add.sprite(100, 715, 'dude');
        this.player.setBounce(0);
        this.player.setCollideWorldBounds(true);

        this.anims.create({
            key: 'left',
            frames: this.anims.generateFrameNumbers('dude', { start: 0, end: 3 }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: 'turn',
            frames: [ { key: 'dude', frame: 4 } ],
            frameRate: 20
        });

        this.anims.create({
            key: 'right',
            frames: this.anims.generateFrameNumbers('dude', { start: 5, end: 8 }),
            frameRate: 10,
            repeat: -1
        });

        this.cursors = this.input.keyboard!.createCursorKeys();

        this.stars = this.physics.add.group({
            key: 'star',
            repeat: 9,
            setXY: { x: 25, y: 0, stepX: 100 }
        });

        this.stars.getChildren().forEach(function (child) {
            (child as Phaser.Physics.Arcade.Sprite).setBounceY(Phaser.Math.FloatBetween(0.4, 0.8));
        });

        this.bombs = this.physics.add.group();

        this.scoreText = this.add.text(16, 16, 'score: 0', { fontSize: '32px', color: '#000' });

        this.physics.add.collider(this.stars, this.platforms);
        this.physics.add.collider(this.bombs, this.platforms);

        this.physics.add.collider(
            this.player,
            this.platforms,
            (obj1, obj2) => {
                const player = obj1 as Phaser.Physics.Arcade.Sprite;
                const platform = obj2 as Phaser.Physics.Arcade.Sprite;

                if (player.body!.touching.down && platform.body!.touching.up) {
                    const platformBody = platform.body as Phaser.Physics.Arcade.Body;
                    this.platformVelocity = platformBody.velocity.x;
                }
            },
            (obj1, _) => {
                const body = obj1.body as Phaser.Physics.Arcade.Body;
                return body.velocity.y >= 0;
            },
            this
        );

        this.physics.add.overlap(this.player, this.stars, this.collectStar, undefined, this);
        this.physics.add.collider(this.player, this.bombs, this.hitBomb, undefined, this);

        this.gameOverText = this.add.text(512, 384, 'GAME OVER\nAppuyez sur ESPACE pour rejouer', {
            fontSize: '42px',
            color: '#ff0000',
            align: 'center',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6
        });
        this.gameOverText.setOrigin(0.5).setDepth(1000).setVisible(false);

        this.physics.pause();

        this.startScreen = this.add.container(512, 384);

        const bg = this.add.rectangle(0, 0, 800, 500, 0x000000, 0.8);

        const instructions = this.add.text(0, 0,
            'COMMANDES DU JEU\n\n' +
            '← → : Se déplacer\n' +
            '↑ : Sauter (Double saut possible)\n' +
            '↓ : Chute rapide\n' +
            '↓ + ESPACE : Descendre d\'une plateforme\n' +
            'GAUCHE/DROITE + ESPACE : Dash\n\n' +
            'Appuyez sur ESPACE pour commencer !',
            {
                fontSize: '24px',
                color: '#ffffff',
                align: 'center',
                lineSpacing: 10
            }
        ).setOrigin(0.5);

// On met tout dans le conteneur
        this.startScreen.add([bg, instructions]);
        this.startScreen.setDepth(2000); // Au dessus de tout
    }

    update ()
    {
        const spaceJustDown = Phaser.Input.Keyboard.JustDown(this.cursors.space);

        if (!this.gameStarted) {
            if (spaceJustDown) {
                this.gameStarted = true;
                this.startScreen.setVisible(false);
                this.physics.resume();
            }
            return;
        }

        if (this.gameOver) {
            if (spaceJustDown) {
                this.gameOver = false;
                this.gameStarted = false;
                this.score = 0;
                this.scene.restart();
            }
            return;
        }

        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-160 + this.platformVelocity);
            this.player.anims.play('left', true);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(160 + this.platformVelocity);
            this.player.anims.play('right', true);
        } else {
            this.player.setVelocityX(this.platformVelocity);
            this.player.anims.play('turn');
        }

        if (this.cursors.up.isDown && this.player.body!.touching.down) {
            this.player.setVelocityY(-330);
        }

        if ((Phaser.Input.Keyboard.JustDown(this.cursors.up) && !this.player.body!.touching.down) && this.canDoubleJump) {
            this.player.setVelocityY(-200);
            this.canDoubleJump = false;
        }

        if (this.cursors.down.isDown && !this.player.body!.touching.down && !this.isDropping) {
            this.player.setVelocityY(700);
        }

        if (spaceJustDown && this.cursors.left.isDown && this.canDash && this.gameStarted) {
            this.player.setVelocityX(-3000);
            this.canDash = false;
        }

        if (spaceJustDown && this.cursors.right.isDown && this.canDash && this.gameStarted) {
            this.player.setVelocityX(3000);
            this.canDash = false;
        }

        if (this.player.body!.touching.down && this.cursors.down.isDown && spaceJustDown && this.player.y < 700) {

            const body = this.player.body as Phaser.Physics.Arcade.Body;

            body.checkCollision.down = false;
            this.isDropping = true;

            this.player.setVelocityY(150);

            this.time.delayedCall(250, () => {
                body.checkCollision.down = true;
                this.isDropping = false;
            });
        }

        if (this.player.body!.touching.down){
            this.canDoubleJump = true;
            this.canDash = true;
        }

        this.platformVelocity = 0;
    }

    collectStar(object1: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile, object2: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile)
    {
        const playerSprite = object1 as Phaser.Physics.Arcade.Sprite;
        const star = object2 as Phaser.Physics.Arcade.Sprite;

        star.disableBody(true, true);

        this.score += 10;
        this.scoreText.setText('Score: ' + this.score);

        if (this.stars.countActive(true) === 0)
        {
            //  A new batch of stars to collect
            this.stars.getChildren().forEach(function (child) {

                const sprite = child as Phaser.Physics.Arcade.Sprite;
                sprite.enableBody(true, sprite.x, 0, true, true);

            });

            var x = (playerSprite.x < 400) ? Phaser.Math.Between(400, 800) : Phaser.Math.Between(0, 400);

            var bomb = this.bombs.create(x, 16, 'bomb');
            bomb.setBounce(1);
            bomb.setCollideWorldBounds(true);
            bomb.setVelocity(Phaser.Math.Between(-200, 200), 20);
            bomb.allowGravity = false;

        }
    }

    hitBomb (_object1: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile, _object2: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile)
    {
        this.physics.pause();

        this.player.setTint(0xff0000);
        this.player.anims.play('turn');

        this.gameOver = true;
        this.gameOverText.setVisible(true);
    }
}
