const path = require('path');
const fs = require('fs');

module.exports = async function informationRussian(bot, chatId, messageId) {
    // Путь к папке public
    const pdfFolderPath = path.join(process.cwd(), 'public');

    // Массив имен PDF файлов
    const pdfFiles = [
        'ЛОНГРИД_Агранович_Андрей_Олегович_1.pdf',
        'ЛОНГРИД_Агранович_Андрей_Олегович_2.pdf',
        'ЛОНГРИД_Агранович_Андрей_Олегович_3.pdf',
        'ЛОНГРИД_Агранович_Андрей_Олегович_4.pdf',
        'ЛОНГРИД_Агранович_Андрей_Олегович_5.pdf',
        'ЛОНГРИД_Агранович_Андрей_Олегович_6.pdf',
        'ЛОНГРИД_Агранович_Андрей_Олегович_7.pdf'
    ];

    // Базовое сообщение с видео (без кнопки Назад)
    const informationMessage = `
Ссылка на видео о заболевании:
[Смотреть видео](https://www.youtube.com/watch?v=LJSA70Idup8&list=PL_VDgqjcR4c1llliw8L2zbilbvyfPzY23)

Дополнительные материалы отправлены отдельными сообщениями ниже.
    `;

    // Отправляем основное сообщение без кнопки
    await bot.editMessageText(informationMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
    });

    // Отправляем каждый PDF файл
    for (const pdfFile of pdfFiles) {
        try {
            const filePath = path.join(pdfFolderPath, pdfFile);

            if (fs.existsSync(filePath)) {
                await bot.sendDocument(chatId, filePath, {
                });
            }
        } catch (error) {
            console.error(`Ошибка при отправке файла ${pdfFile}:`, error);
        }
    }

    // После отправки всех файлов отправляем сообщение с кнопкой "Назад"
    const backMessage = 'Все материалы отправлены. Используйте кнопку ниже для возврата.';

    await bot.sendMessage(chatId, backMessage, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Назад', callback_data: 'back_to_profile' }]
            ]
        }
    });
};