const db = require('../../config/db');

// Обработчик для связи с врачом (английский)
module.exports = async function handleDoctorConnectionEnglish(bot, chatId) {
    await bot.sendMessage(chatId, "Please enter the doctor's key:");

    bot.once('message', async (msg) => {
        const doctorKey = msg.text;
        const result = await db.query('SELECT * FROM doctors WHERE doctor_key = $1', [doctorKey]);

        if (result.rows.length > 0) {
            await db.query('UPDATE users SET doctor_key = $1 WHERE chat_id = $2', [doctorKey, chatId]); // Save doctor key
            await bot.sendMessage(chatId, "You are now connected to your doctor.", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Back to Profile', callback_data: 'back_to_profile' }],
                        [{ text: 'View Messages', callback_data: 'view_messages_english' }],
                        [{ text: 'Send Message', callback_data: 'send_message_english' }],
                    ],
                },
            });
        } else {
            await bot.sendMessage(chatId, "Invalid key. Please try again.");
            handleDoctorConnectionEnglish(bot, chatId);
        }
    });
};
