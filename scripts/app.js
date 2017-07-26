require(["levels.min", "cookies.min"], function (Levels) {

    //#region app.js Scoped Global Variables
    var aMaze = this;
    aMaze.CIRCLE = Math.PI * 2,
    aMaze.MOBILE = /Android|webOS|iPhone|iPad/i.test(navigator.userAgent),
    aMaze.TOUCHSCREEN = ("ontouchstart" in window),
    aMaze.currentPostition = document.getElementById("position"),
    aMaze.currentLevelDisplay = document.getElementById("currentLevel"),
    aMaze.instructions = document.getElementById("instructions"),
    aMaze.display = document.getElementById("display");
    //#endregion

    //#region Controls
    function Controls() {
        this.codes = { 37: "left", 39: "right", 38: "forward", 40: "backward" };
        this.states = { "left": false, "right": false, "forward": false, "backward": false };

        document.addEventListener("keydown", this.onKey.bind(this, true), false);
        document.addEventListener("keyup", this.onKey.bind(this, false), false);
        aMaze.display.addEventListener("touchstart", this.onTouch.bind(this), false);
        aMaze.display.addEventListener("touchmove", this.onTouch.bind(this), false);
        aMaze.display.addEventListener("touchend", this.onTouchEnd.bind(this), false);
    }

    Controls.prototype.onTouch = function (e) {
        var t = e.touches[0];
        this.onTouchEnd(e);
        if (t.pageY < window.innerHeight * 0.5) this.onKey(true, { keyCode: 38 });
        else if (t.pageX < window.innerWidth * 0.5) this.onKey(true, { keyCode: 37 });
        else if (t.pageY > window.innerWidth * 0.5) this.onKey(true, { keyCode: 39 })
    };

    Controls.prototype.onTouchEnd = function (e) {
        this.states = { "left": false, "right": false, "forward": false, "backward": false };
        e.preventDefault();
        e.stopPropagation();
    };

    Controls.prototype.onKey = function (val, e) {
        var state = this.codes[e.keyCode];
        if (typeof state === "undefined") return;
        this.states[state] = val;
        e.preventDefault && e.preventDefault();
        e.stopPropagation && e.stopPropagation();
    };
    //#endregion

    //#region Bitmap
    function Bitmap(src, width, height) {
        this.image = new Image();
        this.image.src = src;
        this.width = width;
        this.height = height;
    }
    //#endregion

    //#region Player
    function Player(x, y, direction) {
        this.x = x;
        this.y = y;
        this.direction = direction;
        this.paces = 0;
    }

    Player.prototype.rotate = function (angle) {
        this.direction = (this.direction + angle + aMaze.CIRCLE) % (aMaze.CIRCLE);
    };

    Player.prototype.walk = function (distance, map) {
        var dx = Math.cos(this.direction) * distance;
        var dy = Math.sin(this.direction) * distance;
        if (map.get(this.x + dx, this.y) <= 0) this.x += dx;
        if (map.get(this.x, this.y + dy) <= 0) this.y += dy;

        if (this.y > map.size || this.y < 0 || this.x > map.size || this.x < 0) {
            if (!aMaze.mazeCompleted) {
                aMaze.mazeCompleted = true;
            }
            else {
                aMaze.loop.stop();
                var nextLevel = aMaze.currentLevel + 1;
                if (Levels.length == nextLevel) {
                    alert("恭喜你! 過關了! )");
                }
                else {
                    if (confirm("成功逃離, 移往下一個等級.")) {
                        aMaze.currentLevel++
                    }
                    aMaze.onRestartLevel();
                }
            }
        }
        else {
            this.paces += distance;
        }
    };

    Player.prototype.update = function (controls, map, seconds) {
        aMaze.updatesMade++;
        if (controls.left) this.rotate(-Math.PI * seconds);
        if (controls.right) this.rotate(Math.PI * seconds);
        if (controls.forward) this.walk(3 * seconds, map);
        if (controls.backward) this.walk(-3 * seconds, map);

        currentPostition.innerHTML = "X軸: " + Math.round(this.x) + " -- Y軸: " + Math.round(this.y);
     
    };

    Player.prototype.getCardinalDirection = function (dir) {

        var dirString = "E",
            directionThreshold = 0.39269908125,
            seValue = 0.7853981625,
            sValue = 1.570796325,
            swValue = 2.3561944875,
            wValue = 3.14159265,
            nwValue = 3.9269908125,
            nValue = 4.712388975,
            neValue = 5.4977871375,
            eValue = 6.2831853;

        if ((dir >= (seValue - directionThreshold)) && (dir <= (seValue + directionThreshold))) {
            dirString = "SE";
        }
        else if ((dir >= (sValue - directionThreshold)) && (dir <= (sValue + directionThreshold))) {
            dirString = "S";
        }
        else if ((dir >= (swValue - directionThreshold)) && (dir <= (swValue + directionThreshold))) {
            dirString = "SW";
        }
        else if ((dir >= (wValue - directionThreshold)) && (dir <= (wValue + directionThreshold))) {
            dirString = "W";
        }
        else if ((dir >= (nwValue - directionThreshold)) && (dir <= (nwValue + directionThreshold))) {
            dirString = "NW";
        }
        else if ((dir >= (nValue - directionThreshold)) && (dir <= (nValue + directionThreshold))) {
            dirString = "N";
        }
        else if ((dir >= (neValue - directionThreshold)) && (dir <= (neValue + directionThreshold))) {
            dirString = "NE";
        }

        return dirString;

    };
    //#endregion

    //#region Map
    function Map(level) {
        this.size = level.size;
        this.walllevel = level.walls;
        this.skybox = (level.skybox ? new Bitmap(level.skybox.path, level.skybox.width, level.skybox.height) :
                                      new Bitmap("assets/blue_BG.jpg", 1920, 1200));
        this.wallTexture = (level.wallTexture ? new Bitmap(level.wallTexture.path, level.wallTexture.width, level.wallTexture.height) :
                                               new Bitmap("assets/Wall4.jpg", 1920, 996));
        this.light = (level.light ? level.light : 0.6);
    }

    Map.prototype.get = function (x, y) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || x > this.size - 1 || y < 0 || y > this.size - 1) return -1;
        return this.walllevel[y * this.size + x];
    };

    Map.prototype.cast = function (point, angle, range) {
        var self = this;
        var sin = Math.sin(angle);
        var cos = Math.cos(angle);
        var noWall = { length2: Infinity };

        return ray({ x: point.x, y: point.y, height: 0, distance: 0 });

        function ray(origin) {
            var stepX = step(sin, cos, origin.x, origin.y);
            var stepY = step(cos, sin, origin.y, origin.x, true);
            var nextStep = stepX.length2 < stepY.length2
              ? inspect(stepX, 1, 0, origin.distance, stepX.y)
              : inspect(stepY, 0, 1, origin.distance, stepY.x);

            if (nextStep.distance > range) return [origin];
            return [origin].concat(ray(nextStep));
        }

        function step(rise, run, x, y, inverted) {
            if (run === 0) return noWall;
            var dx = run > 0 ? Math.floor(x + 1) - x : Math.ceil(x - 1) - x;
            var dy = dx * (rise / run);
            return {
                x: inverted ? y + dy : x + dx,
                y: inverted ? x + dx : y + dy,
                length2: dx * dx + dy * dy
            };
        }

        function inspect(step, shiftX, shiftY, distance, offset) {
            var dx = cos < 0 ? shiftX : 0;
            var dy = sin < 0 ? shiftY : 0;
            step.height = self.get(step.x - dx, step.y - dy);
            step.distance = distance + Math.sqrt(step.length2);
            if (shiftX) step.shading = cos < 0 ? 2 : 0;
            else step.shading = sin < 0 ? 2 : 1;
            step.offset = offset - Math.floor(offset);
            return step;
        }
    };

    Map.prototype.update = function (seconds) {
        if (this.light > 0) this.light = Math.max(this.light - 10 * seconds, 0);
        else if (Math.random() * 5 < seconds) this.light = 2;
    };
    //#endregion

    //#region Camera
    function Camera(canvas, resolution, focalLength) {
        this.ctx = canvas.getContext("2d");
        this.width = canvas.width = window.innerWidth * 0.5;
        this.height = canvas.height = window.innerHeight * 0.5;
        this.resolution = resolution;
        this.spacing = this.width / resolution;
        this.focalLength = focalLength || 0.8;
        this.range = aMaze.MOBILE ? 14 : 28;
        this.lightRange = 10;
        this.scale = (this.width , this.height);
    }

    Camera.prototype.render = function (player, map) {
        this.drawSky(player.direction, map.skybox, map.light);
        this.drawColumns(player, map);
    };

    Camera.prototype.drawSky = function (direction, sky, ambient) {
        var width = sky.width * (this.height / sky.height) * 2;
        var left = (direction / aMaze.CIRCLE) * -width;

        this.ctx.save();
        this.ctx.drawImage(sky.image, left, 0, width, this.height);
        if (left < width - this.width) {
            this.ctx.drawImage(sky.image, left + width, 0, width, this.height);
        }

        this.ctx.restore();
    };

    Camera.prototype.drawColumns = function (player, map) {
        this.ctx.save();
        for (var column = 0; column < this.resolution; column++) {
            var x = column / this.resolution - 0.5;
            var angle = Math.atan2(x, this.focalLength);
            var ray = map.cast(player, player.direction + angle, this.range);
            this.drawColumn(column, ray, angle, map);
        }
        this.ctx.restore();
    };

    Camera.prototype.drawColumn = function (column, ray, angle, map) {
        var ctx = this.ctx;
        var texture = map.wallTexture;
        var left = Math.floor(column * this.spacing);
        var width = Math.ceil(this.spacing);
        var hit = -1;

        while (++hit < ray.length && ray[hit].height <= 0);

        for (var s = ray.length - 1; s >= 0; s--) {
            var step = ray[s];

            if (s === hit) {
                var textureX = Math.floor(texture.width * step.offset);
                var wall = this.project(step.height, angle, step.distance);
                ctx.globalAlpha = 1;
                ctx.drawImage(texture.image, textureX, 0, 1, texture.height, left, wall.top, width, wall.height);

                ctx.fillStyle = "#08083c";
                ctx.globalAlpha = Math.max((step.distance + step.shading) / this.lightRange - map.light, 0);
                ctx.fillRect(left, wall.top, width, wall.height);
            }

            ctx.fillStyle = "#fff";
            ctx.globalAlpha = 0.15;
        }
    };

    Camera.prototype.project = function (height, angle, distance) {
        var z = distance * Math.cos(angle);
        var wallHeight = this.height * height / z;
        var bottom = this.height / 2 * (1 + 1 / z);
        return {
            top: bottom - wallHeight,
            height: wallHeight
        };
    };
    //#endregion

    //#region GameLoop
    function GameLoop() {
        this.frame = this.frame.bind(this);
        this.lastTime = 0;
        this.callback = function () { };
    }

    GameLoop.prototype.start = function (callback) {
        this.callback = callback;
        requestAnimationFrame(this.frame);
    };

    GameLoop.prototype.stop = function () {
        this.callback = null;
        requestAnimationFrame(this.frame);
    };

    GameLoop.prototype.frame = function (time) {
        var seconds = (time - this.lastTime) / 1000;
        this.lastTime = time;
        if (this.callback !== null) {
            if (seconds < 0.2) this.callback(seconds);
            requestAnimationFrame(this.frame);
        }
    };
    //#endregion
    //#region nowtime
    var c=0,nowtime,endtime;
    function timecount(){
        document.getElementById("nowtime").value=time;
        c=c+1;
        setTimeout("timeCount()",1000);
    }
    var nowtime = new Date();
    var time = "開始時間:"+
            nowtime.getHours()+"時"+
            nowtime.getMinutes()+"分"+
            nowtime.getSeconds()+"秒";
    
    document.getElementById("nowtime").value=time;
    
    
    //document.writeln(getElementById("runtime").value=time);
    
    ;
    //#endregion

    //#region aMaze
    aMaze.init = function (level) {
        
        aMaze.currentLevelDisplay.innerHTML = "等級: " + level.id;
        aMaze.mazeCompleted = false;
        aMaze.player = new Player(level.startingPoint.x,level.startingPoint.y, level.startingDirection);

        aMaze.map = new Map(level);
        aMaze.controls = new Controls();
        aMaze.camera = new Camera(aMaze.display, aMaze.MOBILE ? 320 : 640, .5);
        aMaze.loop = new GameLoop();

        aMaze.loop.start(function frame(seconds) {
            aMaze.player.update(aMaze.controls.states, aMaze.map, seconds);
            aMaze.camera.render(aMaze.player, aMaze.map);
            var endtime = new Date();
            setTimeout(function() {
            document.getElementById("runtime").value=time;    
            }, 1000); 
            time="執行時間:"+(endtime.getSeconds()-nowtime.getSeconds())+"秒";
        });

        instructions.style.display = "block";
        setTimeout(function () {
            instructions.style.display = "none";
        }, 10000);
    };

    aMaze.onRestartLevel = function () {
        aMaze.loop.stop();
        aMaze.clearLocation();
        aMaze.init(Levels[aMaze.currentLevel]);
    };

    aMaze.onRestartGame = function () {
        
        aMaze.currentLevel = 0;
        aMaze.onRestartLevel();
    };

    aMaze.clearLocation = function () {
        
    }

    aMaze.setLocation = function (x, y, dir) {

    }

    document.getElementById("restartLevel").addEventListener("click", aMaze.onRestartLevel.bind(this), false);
    document.getElementById("restartGame").addEventListener("click", aMaze.onRestartGame.bind(this), false);
    if (!aMaze.TOUCHSCREEN) {
        aMaze.instructions.innerHTML = "請使用上下左右鍵";
    }
    else {
        aMaze.instructions.innerHTML = "請試著上下左右轉繞著迷宮";
    }



    aMaze.updatesMade = 0;
    aMaze.currentLevel = 0;
    aMaze.init(Levels[aMaze.currentLevel]);
    //#endregion

});
