const db = require('../../config/db');
const ExcelJS = require('exceljs');
const moment = require('moment');
const path = require('path');
const fs = require('fs');

const mainKeyboard = {
    inline_keyboard: [
        [
            { text: 'Send to Doctor', callback_data: 'send_statistic_to_doctor_en' },
            { text: 'Weekly Statistics', callback_data: 'week_statistic_en' }
        ],
        [
            { text: 'Monthly Statistics', callback_data: 'month_statistic_en' },
            { text: 'Go Back', callback_data: 'back_to_profile' }
        ]
    ]
};

const backKeyboard = {
    inline_keyboard: [
        [{ text: 'Go Back', callback_data: 'back_to_statistic_en' }]
    ]
};

let botInstance = null;
let isHandlerRegistered = false;

async function generateStatisticFileEnglish(chatId, period) {
    const periodDate = period === 'week'
        ? moment().subtract(7, 'days').format('YYYY-MM-DD')
        : moment().subtract(1, 'month').format('YYYY-MM-DD');

    const calendarResult = await db.query(
        'SELECT * FROM calendar WHERE user_id = $1 AND date >= $2 ORDER BY date',
        [chatId, periodDate]
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Statistics for ${period === 'week' ? 'Week' : 'Month'}`);

    worksheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Had Seizure', key: 'had_seizure', width: 15 },
        { header: 'Seizure Duration', key: 'seizure_duration', width: 20 },
        { header: 'Seizure Description', key: 'seizure_description', width: 30 },
        { header: 'Trigger', key: 'trigger', width: 20 },
        { header: 'Repeated Seizures', key: 'repeated_seizures', width: 20 },
        { header: 'Note', key: 'note_text', width: 30 }
    ];

    calendarResult.rows.forEach(row => {
        worksheet.addRow({
            date: moment(row.date).format('DD.MM.YYYY'),
            had_seizure: row.had_seizure ? 'Yes' : 'No',
            seizure_duration: row.seizure_duration || '-',
            seizure_description: row.seizure_description || '-',
            trigger: row.trigger || '-',
            repeated_seizures: row.repeated_seizures || '-',
            note_text: row.note_text || '-'
        });
    });

    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin', color: { argb: '000000' } },
                left: { style: 'thin', color: { argb: '000000' } },
                bottom: { style: 'thin', color: { argb: '000000' } },
                right: { style: 'thin', color: { argb: '000000' } }
            };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'ADD8E6' }
            };
        });
    });

    const publicDir = path.join(__dirname, '..', 'public');
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir);
    }

    const fileName = `${period}_statistic_en_${chatId}_${Date.now()}.xlsx`;
    const filePath = path.join(publicDir, fileName);

    await workbook.xlsx.writeFile(filePath);
    return filePath;
}

module.exports = async function statisticEnglish(bot, chatId, messageId) {
    botInstance = bot;

    if (!isHandlerRegistered) {
        bot.removeListener('callback_query', handleStatisticCallbacksEnglish);
        bot.on('callback_query', (query) => handleStatisticCallbacksEnglish(query, bot));
        isHandlerRegistered = true;
    }

    await bot.editMessageText('Choose an action:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: mainKeyboard
    });
};

async function handleStatisticCallbacksEnglish(query, bot) {
    const data = query.data;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    try {
        if (data === 'back_to_statistic_en') {
            await bot.editMessageText('Choose an action:', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: mainKeyboard
            });
        }
        else if (data === 'week_statistic_en') {
            const filePath = await generateStatisticFileEnglish(chatId, 'week');
            await bot.sendDocument(chatId, filePath);
            await bot.editMessageText('Weekly statistics generated:', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: backKeyboard
            });
        }
        else if (data === 'month_statistic_en') {
            const filePath = await generateStatisticFileEnglish(chatId, 'month');
            await bot.sendDocument(chatId, filePath);
            await bot.editMessageText('Monthly statistics generated:', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: backKeyboard
            });
        }
        else if (data === 'send_statistic_to_doctor_en') {
            const userResult = await db.query(
                'SELECT name, doctor_key FROM users WHERE chat_id = $1',
                [chatId]
            );

            if (!userResult.rows[0] || !userResult.rows[0].doctor_key) {
                await bot.editMessageText('You have not entered a doctor key', {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: backKeyboard
                });
                return;
            }

            const userName = userResult.rows[0].name;
            const doctorKey = userResult.rows[0].doctor_key;

            const doctorQuery = await db.query(
                'SELECT chat_id FROM doctors WHERE doctor_key = $1',
                [doctorKey]
            );

            if (doctorQuery.rows.length === 0) {
                await bot.editMessageText('Invalid doctor key', {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: backKeyboard
                });
                return;
            }

            const doctorChatId = doctorQuery.rows[0].chat_id;
            const filePath = await generateStatisticFileEnglish(chatId, 'month');

            await bot.sendDocument(doctorChatId, filePath, {
                caption: `Seizure statistics for patient ${userName} for the past month`
            });

            await bot.editMessageText('Statistics sent to the doctor', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: backKeyboard
            });
        }
    } catch (error) {
        console.error('Error processing statistics:', error);
        await bot.editMessageText('An error occurred', {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: backKeyboard
        });
    }
}