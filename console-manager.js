const definitions = require('./definitions');

let consoleGif = {
    timer: -1,
    frame: 0,
    text: ''
};

//*************************************************************************************************
exports.write = function (text, color = 'DEFAULT') {
    console.log(definitions.CONSOLE_COLORS[String(color).toUpperCase()], text, definitions.CONSOLE_RESET);
};

//*************************************************************************************************
exports.setLiveText = function (text) {
    consoleGif.text = text;
    if (consoleGif.timer !== -1) {
        return;
    }

    consoleGif.timer = setInterval(()=>{
        process.stdout.write(`${definitions.CONSOLE_ANIMATION[consoleGif.frame%definitions.CONSOLE_ANIMATION.length]} ${consoleGif.text}\r`);
        consoleGif.frame = ++consoleGif.frame % definitions.CONSOLE_ANIMATION.length;
    }, definitions.CONSOLE_ANIMATION_SPEED);
};

//*************************************************************************************************
exports.hideLiveText = function () {
    clearInterval(consoleGif.timer);
    consoleGif.timer = -1;
    process.stdout.write('');
};