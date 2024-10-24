const db = require('../../config/db');

module.exports = async function notificationHandlersEnglish(bot, chatId, messageId) {
    const message = "Here you can change the time or text of your notification";
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Text', callback_data: 'change_text' },
                    { text: 'Time', callback_data: 'change_time' },
                ],
                [
                    { text: 'Back', callback_data: 'back_to_profile' },
                ],
            ],
        }
    };

    // Edit existing message with new text and buttons
    await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: options.reply_markup
    });

    // Set up listener for button clicks
    bot.once('callback_query', async (query) => {
        if (query.data !== 'back_to_profile') {
            await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: messageId
            });
            await handleCallbackQueryEnglish(bot, chatId, query.data);
        }
    });
};

// Callback query handler
async function handleCallbackQueryEnglish(bot, chatId, callbackData) {
    switch (callbackData) {
        case 'change_text':
            await handleChangeTextEnglish(bot, chatId);
            break;
        case 'change_time':
            await handleChangeTimeEnglish(bot, chatId);
            break;
    }
}

// Text change handler
async function handleChangeTextEnglish(bot, chatId) {
    await bot.sendMessage(chatId, "Write the message that I will send you every day at your chosen time.");

    bot.once('message', async (msg) => {
        const notificationText = msg.text;
        await db.query('UPDATE users SET notification_text = $1 WHERE chat_id = $2', [notificationText, chatId]);

        const confirmMessage = `Great, now instead of the standard notification, I will send you this: "${notificationText}".`;
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Return to profile', callback_data: 'back_to_profile' }],
                ],
            },
        };
        await bot.sendMessage(chatId, confirmMessage, options);
    });
}

// Time change handler
async function handleChangeTimeEnglish(bot, chatId) {
    const message = "When would you like to receive notifications?";
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Morning', callback_data: 'time_morning_edit' },
                    { text: 'Afternoon', callback_data: 'time_afternoon_edit' },
                    { text: 'Evening', callback_data: 'time_evening_edit' },
                ],
            ],
        },
    };
    const sentMessage = await bot.sendMessage(chatId, message, options);

    bot.once('callback_query', async (query) => {
        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: sentMessage.message_id
        });
        await handleSetTimeEnglish(bot, chatId, query.data);
    });
}

// Time setting handler
async function handleSetTimeEnglish(bot, chatId, callbackData) {
    let hoursOptions = [];
    const timeRanges = {
        'time_morning_edit': Array.from({ length: 6 }, (_, i) => i + 6),
        'time_afternoon_edit': Array.from({ length: 6 }, (_, i) => i + 12),
        'time_evening_edit': Array.from({ length: 6 }, (_, i) => i + 18)
    };

    const selectedRange = timeRanges[callbackData];
    if (selectedRange) {
        hoursOptions = createTimeButtonsEnglish(selectedRange);
    }

    const message = 'Choose a time in your local timezone:';
    const hourOptions = {
        reply_markup: {
            inline_keyboard: hoursOptions,
        },
    };
    const sentMessage = await bot.sendMessage(chatId, message, hourOptions);

    bot.once('callback_query', async (query) => {
        await bot.editMessageText(message, {
            chat_id: chatId,
            message_id: sentMessage.message_id
        });

        if (query.data.startsWith('hour_') && query.data.endsWith('_edit')) {
            await saveSelectedTimeEnglish(bot, chatId, query.data);
        }
    });
}

// Helper function for creating time buttons
function createTimeButtonsEnglish(hours) {
    const buttons = [];
    let row = [];

    hours.forEach(hour => {
        row.push({ text: `${hour}:00`, callback_data: `hour_${hour}_edit` });
        if (row.length === 3) {
            buttons.push([...row]);
            row = [];
        }
    });

    if (row.length > 0) {
        buttons.push(row);
    }

    return buttons;
}

// Save selected time
async function saveSelectedTimeEnglish(bot, chatId, hourData) {
    const hour = parseInt(hourData.split('_')[1]);
    const user = await db.query('SELECT timezone_gmt FROM users WHERE chat_id = $1', [chatId]);
    const timezoneGmt = user.rows[0]?.timezone_gmt || 0;

    const notificationHourGmt = (hour - timezoneGmt + 24) % 24;
    const notificationHourMsk = hour - timezoneGmt + 3;

    await db.query(
        'UPDATE users SET notification_hour_gmt = $1, notification_hour_msk = $2 WHERE chat_id = $3',
        [notificationHourGmt, notificationHourMsk, chatId]
    );

    const confirmationMessage = `Notification time updated to: ${hour}:00 in your time. To return to profile, click the "Return" button.`;
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Return', callback_data: 'back_to_profile' }],
            ],
        },
    };
    await bot.sendMessage(chatId, confirmationMessage, options);
}