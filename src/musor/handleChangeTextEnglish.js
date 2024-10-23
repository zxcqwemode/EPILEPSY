const db = require('../config/db'); // Importing the database

// Function to handle changing notification text
module.exports = async function handleChangeTextEnglish(bot, chatId) {
    // Message asking the user to enter the notification text
    await bot.sendMessage(chatId, "Please write the message that I will send you every day at your chosen time.");

    // Handler for the user's text message
    bot.once('message', async (msg) => {
        const notificationText = msg.text; // Getting the text from the user

        // Saving the text to the database
        await db.query('UPDATE users SET notification_text = $1 WHERE chat_id = $2', [notificationText, chatId]);

        // Confirming to the user
        await bot.sendMessage(chatId, `Great, I will now send you this instead of the standard notification: "${notificationText}".`);

        // Button to return to profile
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Return to profile', callback_data: 'back_to_profile' }],
                ],
            },
        };
        await bot.sendMessage(chatId, 'To return to your profile, press the button below:', options);
    });
};
