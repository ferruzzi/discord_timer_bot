const version = "0.0.1";

const Discord = require('discord.js');
const logger = require('winston');
const auth = require('./auth.json');
const config = require('./config.json');

global.protected_bases = [];

function set_timer(msg, args){

    let time_unit = "";
    let timeout = 1;
    let message =  args.slice(3).join(" ");

    switch (args[2].charAt(0).toLowerCase()) {
        case "w":
            time_unit = "weeks";
            timeout = args[1] * 604800000;
            break;
        case "d":
            time_unit = "days";
            timeout = args[1] * 86400000;
            break;
        case "h":
            time_unit = "hours";
            timeout = args[1] * 3600000;
            break;
        case "m":
            time_unit = "minutes";
            timeout = args[1] * 60000;
            break;
        case "s":
            time_unit = "seconds";
            timeout = args[1] * 1000;
            break;
        default:
            msg.channel.send(`I do not understand ${args[2]} as a unit of time.`);
    }

    msg.channel.send(`I will remind you to ${message} in ${args[1]} ${time_unit}.`);

    logger.info(`Adding a reminder to ${message} in ${args[1]} ${time_unit}`);
    setTimeout(function(){
         msg.channel.send(`It is time to ${message}!`);
         logger.debug(`Reminder sent to ${message}`)},
        timeout);
}

function set_protection(msg, location) {
    /*********************************************
    - check if new base is already protected
    - if timer remaining is within reup time, then
    - cancel old timers
    - set new timers
    **********************************************/

    if (!location) {
        /*****
        *  The easy out is to scold them and move on:
        *      msg.channel.send("You must enter a base to protect.  For example:\n\t!p Coneyre");
        *  But if I can I want to send a DM to prompt for missing variable
        *****/

        // This block modified from:
        //      https://stackoverflow.com/questions/51116013/await-reply-in-private-message-discord-js

        logger.debug(`${msg.author.username} invoked protection without a location; prompting for info`);

        // Message the user for clarification
        msg.author.send("Which claim would you like to protect?")
            .then((newmsg) => { //Now newmsg is the message you sent
                newmsg.channel.awaitMessages(response => newmsg.content, {
                    max: 1,         // Take the next message
                    time: 60000,    // Wait at most 1 minute for a reply
                    errors: ['time']
                })
                    .then((collected) => {
                        // Set their reply as the location
                        location = collected.first().content;
                        // Confirm that input was received
                        msg.author.send(`${location} confirmed.`);
                        // Advise how they can skip this step in the future
                        msg.author.send('You can prevent this extra step in the future by entering it all at once.  ' +
                            `For example:\n\t!p Coneyre`);
                        // Log that we asked and received clarification for possible tracking reasons
                        logger.debug(`\t${msg.author.username} replied with "${collected.first().content}"`);
                    })
                    .catch(() => {
                        // If the user did not reply to the DM, then post instructions in the main channel
                        msg.channel.send('Protection must be applied to a location, For example:' +
                            `\n\t!protect Coneyre`);
                        // Log that no reply was given for potential tracking purposes
                        logger.error(`\t${msg.author.username} did not reply with a location`);
                    });
            });
    }

    if ((location === "List") || (location === "L")){
        // List bases under protection
        if (!Array.isArray(protected_bases) || !protected_bases.length) {
            msg.channel.send(`Currently no claims under protection`);
        }
        else {
            msg.channel.send(`Currently protecting: ${protected_bases.join(', ')}.`);
        }
        return;
    }

    if (!(protected_bases.includes(location))) {
        // Add location to the list of protected bases
        protected_bases.push(location);
        msg.channel.send(location + ` not currently protected, adding new timer.`);
        logger.info(`Added ${location} to protection list`)
    }
    else {
        msg.channel.send(location + ` already has a timer.`);
        return;
    }
    // set a timer to protect it

    // List currently protected bases
    msg.channel.send(`Currently protecting: ${protected_bases.join(', ')}.`);
}

function toTitleCase(str) {
    return str.replace(
        /\w\S*/g,
        function(txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
    );
}

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console({
        format: logger.format.combine(
            logger.format.colorize(),
            logger.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss'
            }),
            logger.format.printf(info =>
                `${info.timestamp} ${info.level}:\t ${info.message}`)
        )
    }));
logger.level = 'debug';

// Initialize Discord Bot
const bot = new Discord.Client();
bot.login(auth.token);

// Log the online status
bot.on('ready', () => {
    logger.info('Connected');
    logger.info(`Logged in as: ${bot.user.username} - (${bot.user.id})`);
    bot.channels.get('550715273645129789').send("I told you I'd be back")
});

bot.on('message', msg => {
    // Ignore messages sent by other bots #nottodayskynet
    if(msg.author.bot) return;

    // If the message starts with our assigned prefix
    if (msg.content.substring(0, 1) === config.prefix) {
        let args = msg.content.substring(1).split(' ');
        let cmd = args[0];

        switch (cmd.toLowerCase()) {
            case 'ping':
                msg.channel.send("No.  I won't say it.");
                break;

            case 'sup':
                msg.channel.send('Monica!');
                break;

            case 'timer':
                // fall through
                case 't':
                    set_timer(msg, args);
                    break;

            case 'protection':
                // fall through
                case 'p':
                    //fall through
                case 'pro':
                    set_protection(msg, toTitleCase(args.slice(1).join(" ")));
                    break;
        }
    }
});