const bot = require('./src/bot');
const handleStartCommand = require('./src/commands/start');

// Основной обработчик для команд
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    switch (msg.text) {
        case '/start':
            handleStartCommand(bot, msg);
            break;
        default:
            bot.sendMessage(chatId, 'Неизвестная команда.');
            break;
    }
});
