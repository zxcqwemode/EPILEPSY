const db = require('../config/db');
const myProfileRussian = require('../handlers/myProfileRussian');
const myProfileEnglish = require('../handlers/myProfileEnglish');

module.exports = async function handleMyProfileCommand(bot, msg) {
    const chatId = msg.chat.id;

    try {
        // Запрос в базу данных для получения информации о пользователе
        const userResult = await db.query('SELECT step, language FROM users WHERE chat_id = $1', [chatId]);

        // Проверяем, существует ли пользователь в базе данных
        if (userResult.rows.length === 0) {
            return bot.sendMessage(chatId, 'Ошибка! Ваш профиль пациента не найден. Пожалуйста, пройдите регистрацию заново, используя команду /start.');
        }

        const user = userResult.rows[0];

        // Проверяем, что пользователь зарегистрирован и у него заполнен профиль
        if (user.step === 'registered' && user.language === 'Русский') {
            // Запускаем обработчик профиля для русскоязычного пользователя
            await myProfileRussian(bot, msg);
        }
        else if (user.step === 'registered' && user.language === 'English') {
            // Запускаем обработчик профиля для англоязычного пользователя
            await myProfileEnglish(bot, msg);
        }
        else {
            // Сообщаем об ошибке, если профиль не завершен
            const errorMessage = user.language === 'English'
                ? 'Error! Your profile is incomplete. Please complete your registration again using the /start command.'
                : 'Ошибка! Ваш профиль пациента не заполнен полностью, пройдите регистрацию заново, используя команду /start.';

            return bot.sendMessage(chatId, errorMessage);
        }

    } catch (err) {
        console.error('Ошибка при обработке команды /myProfile:', err);

        const errorMsg = user.language === 'English'
            ? 'An error occurred while processing your profile. Please try again later.'
            : 'Произошла ошибка при обработке вашего профиля. Попробуйте позже.';

        bot.sendMessage(chatId, errorMsg);
    }
};
