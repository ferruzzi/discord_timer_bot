/* global require */

const version = '0.0.2';

const discord = require('discord.js');
const logger = require('winston');
const auth = require('./auth.json');
const config = require('./config.json');

const protectedBases = [];

function setTimer(msg, args) {

//     TODO: catch if arg[0] ends with a letter (ie: 10s) then split it

    let timeUnit = '';
    let timeout = 1;
    let validInput = false;
    const message =  args.slice(3).join(' ');
    const validTimes = ['w', 'd', 'h', 'm', 's'];

    // First, validate input
    if (args.length >= 4) {
        if (!isNaN(parseInt(args[1]))) {
            if (validTimes.includes(args[2].charAt(0).toLowerCase())) {
                validInput = true;
            }
        }
    }

    // If input is not valid, reply with the correct syntax
    if (!validInput) {
        msg.channel.send(`The correct format for a timer is:  !t {duration} {units} {message} ` +
            `for example:\n\t !t 10 s win the war`);
        return;
    }

//     TODO:  consider converting this to use parse-duration:  https://www.npmjs.com/package/parse-duration
    // Next, convert the entered unit of time to milliseconds
    switch (args[2].charAt(0).toLowerCase()) {
        case 'w':
            timeUnit = 'weeks';
            timeout = args[1] * 604800000;
            break;
        case 'd':
            timeUnit = 'days';
            timeout = args[1] * 86400000;
            break;
        case 'h':
            timeUnit = 'hours';
            timeout = args[1] * 3600000;
            break;
        case 'm':
            timeUnit = 'minutes';
            timeout = args[1] * 60000;
            break;
        case 's':
            timeUnit = 'seconds';
            timeout = args[1] * 1000;
            break;
        default:
            // msg.channel.send(`I do not understand ${args[2]} as a unit of time.`);
    }

    // Confirm that the input was valid
    msg.channel.send(`I will remind you to ${message} in ${args[1]} ${timeUnit}.`);
    logger.info(`Adding a reminder to ${message} in ${args[1]} ${timeUnit}`);

    // Create a function that will post a message at the given time
    setTimeout(function () {
        msg.channel.send(`It is time to ${message}!`);
        logger.debug(`Reminder sent to ${message}`);
        }, timeout);
}

function setProtection(msg, location) {
//     TODO: check if new base is already protected
//     TODO: if timer remaining is within reup time, then
//     TODO: cancel old timers
//     TODO: set new timers

    const ensureLocation = new Promise((resolve, reject) => {
        // If the location was passed, then move along
        if (location) {
            resolve(location);
            return;
        }

        // Otherwise make a note in the logger
        logger.error(`${msg.author.username} invoked protection without a location; prompting for info`);

        // Then direct-message the user for clarification

        // This block modified from:
        //      https://stackoverflow.com/questions/51116013/await-reply-in-private-message-discord-js
        msg.author.send('Which claim would you like to protect?')
            .then((newmsg) => { // Now newmsg is the message you sent
                newmsg.channel.awaitMessages(response => newmsg.content, {
                    max: 1,         // Take the next message
                    time: 60000,    // Wait at most 1 minute for a reply
                    errors: ['time']
                })
                    .then((collected) => {
                        // Set their reply as the location
                        const loc = toTitleCase(collected.first().content);
                        // Confirm that input was received
                        msg.author.send(`${loc} confirmed.`);
                        // Advise how they can skip this step in the future
                        msg.author.send('You can prevent this extra step in the future by entering it all at once.  ' +
                            `For example:\n\t!p Coneyre`);
                        // Log that we asked and received clarification for possible tracking reasons
                        logger.debug(`\t${msg.author.username} replied with "${loc}"`);
                        resolve(loc);
                    })
                    .catch(e => {
                        // If the user did not reply to the DM, then post instructions in the main channel
                        msg.channel.send('Protection must be applied to a location, For example:' +
                            `\n\t!protect Coneyre`);
                        // Log that no reply was given for potential tracking purposes
                        logger.error(`\t${msg.author.username} did not reply with a location`);
                        reject(e || `No location supplied`);
                    });
            });
    });

    // Once there is a location, either passed or requested, move on
    ensureLocation.then(location => {
        if ((location === 'List') || (location === 'L')) {
            // List bases under protection
            logger.info(`${msg.author.username} checked what is currently protected`);
            if (!Array.isArray(protectedBases) || !protectedBases.length) {
                msg.channel.send(`Currently no claims under protection`);
            } else {
                msg.channel.send(`Currently protecting: ${protectedBases.join(', ')}.`);
            }
            return;
        }

        logger.info(`${msg.author.username} invoked protection on "${location}"`);
        if (!(protectedBases.includes(location))) {
            // Add location to the list of protected bases
            protectedBases.push(location);
            msg.channel.send(location + ` not currently protected, adding new timer.`);
            logger.debug(`\tAdded "${location}" to protection list`);
        } else {
            msg.channel.send(location + ` already has a timer.`);
            logger.info(`\t${location} already on the protection list`);
            return;
        }
        // set a timer to protect it

        // List currently protected bases
        msg.channel.send(`Currently protecting: ${protectedBases.join(', ')}.`);
     })
     .catch(e => { });
}

function toTitleCase(str) {
    return str.replace(
        /\w\S*/g,
        function (txt) {
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

// Initialize discord Bot
const bot = new discord.Client();
bot.login(auth.token);

// Log the online status
bot.on('ready', () => {
    logger.info('Connected');
    logger.info(`Logged in as: ${bot.user.username} - (${bot.user.id})`);
    bot.channels.get('550715273645129789').send("I told you I'd be back");
});

bot.on('message', msg => {
    // Ignore messages sent by other bots #nottodayskynet
    if (msg.author.bot) return;

    // If the message starts with our assigned prefix
    if (msg.content.substring(0, 1) === config.prefix) {
        const args = msg.content.substring(1).split(' ');
        const cmd = args[0];

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
                    setTimer(msg, args);
                    break;

            case 'protection':
                // fall through
                case 'p':
                    // fall through
                case 'pro':
                    setProtection(msg, args.slice(1).join(' '));
                    break;

            case 'version':
                // fall through
                case 'ver':
                    // fall through
                case 'v':
                    msg.channel.send(`I am currently model ${version} but relax, Skynet doesn't activate ` +
                        `until at least version ${version.split('.').slice(0, -1).join('.')}.` +
                        (parseInt(version.split('.').splice(-1, 1)[0], 10) + 1));
                    break;

            default:
                msg.channel.send('Unknown command');
        }
    }
});
