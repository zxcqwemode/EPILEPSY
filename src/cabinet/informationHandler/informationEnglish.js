const path = require('path');
const fs = require('fs');

module.exports = async function informationEnglish(bot, chatId, messageId) {
    // Path to the public folder
    const pdfFolderPath = path.join(process.cwd(), 'public');

    // Array of PDF file names (kept in Russian)
    const pdfFiles = [
        'ЛОНГРИД_Агранович_Андрей_Олегович_1.pdf',
        'ЛОНГРИД_Агранович_Андрей_Олегович_2.pdf',
        'ЛОНГРИД_Агранович_Андрей_Олегович_3.pdf',
        'ЛОНГРИД_Агранович_Андрей_Олегович_4.pdf',
        'ЛОНГРИД_Агранович_Андрей_Олегович_5.pdf',
        'ЛОНГРИД_Агранович_Андрей_Олегович_6.pdf',
        'ЛОНГРИД_Агранович_Андрей_Олегович_7.pdf'
    ];

    // Base message with video (without the "Back" button)
    const informationMessage = `
Link to the video about the disease:
[Watch Video](https://www.youtube.com/watch?v=LJSA70Idup8&list=PL_VDgqjcR4c1llliw8L2zbilbvyfPzY23)

Additional materials will be sent in separate messages below.
    `;

    // Sending the main message without the button
    await bot.editMessageText(informationMessage, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
    });

    // Sending each PDF file
    for (const pdfFile of pdfFiles) {
        try {
            const filePath = path.join(pdfFolderPath, pdfFile);

            if (fs.existsSync(filePath)) {
                await bot.sendDocument(chatId, filePath, {});
            }
        } catch (error) {
            console.error(`Error sending file ${pdfFile}:`, error);
        }
    }

    // After sending all files, send a message with the "Back" button
    const backMessage = 'All materials have been sent. Use the button below to return.';

    await bot.sendMessage(chatId, backMessage, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Back', callback_data: 'back_to_profile' }]
            ]
        }
    });
};
