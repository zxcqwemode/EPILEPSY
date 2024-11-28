const db = require('../../config/db');
const ExcelJS = require('exceljs');
const moment = require('moment');
const path = require('path');
const fs = require('fs');

const mainKeyboard = {
    inline_keyboard: [
        [
            { text: 'Отправить врачу', callback_data: 'send_statistic_to_doctor' },
            { text: 'Статистика за неделю', callback_data: 'week_statistic' }
        ],
        [
            { text: 'Статистика за месяц', callback_data: 'month_statistic' },
            { text: 'Вернуться назад', callback_data: 'back_to_profile' }
        ]
    ]
};

const backKeyboard = {
    inline_keyboard: [
        [{ text: 'Вернуться назад', callback_data: 'back_to_statistic_ru' }]
    ]
};

let botInstance = null;
let isHandlerRegistered = false;

async function generateStatisticFile(chatId, period) {
    const periodDate = period === 'week'
        ? moment().subtract(7, 'days').format('YYYY-MM-DD')
        : moment().subtract(1, 'month').format('YYYY-MM-DD');

    const calendarResult = await db.query(
        'SELECT * FROM calendar WHERE user_id = $1 AND date >= $2 ORDER BY date',
        [chatId, periodDate]
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Статистика за ${period === 'week' ? 'неделю' : 'месяц'}`);

    worksheet.columns = [
        { header: 'Дата', key: 'date', width: 15 },
        { header: 'Был приступ', key: 'had_seizure', width: 15 },
        { header: 'Длительность приступа', key: 'seizure_duration', width: 20 },
        { header: 'Описание приступа', key: 'seizure_description', width: 30 },
        { header: 'Триггер', key: 'trigger', width: 20 },
        { header: 'Повторные приступы', key: 'repeated_seizures', width: 20 },
        { header: 'Заметка', key: 'note_text', width: 30 }
    ];

    calendarResult.rows.forEach(row => {
        worksheet.addRow({
            date: moment(row.date).format('DD.MM.YYYY'),
            had_seizure: row.had_seizure ? 'Да' : 'Нет',
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

    const fileName = `${period}_statistic_${chatId}_${Date.now()}.xlsx`;
    const filePath = path.join(publicDir, fileName);

    await workbook.xlsx.writeFile(filePath);
    return filePath;
}

module.exports = async function statisticRussian(bot, chatId, messageId) {
    botInstance = bot;

    if (!isHandlerRegistered) {
        bot.removeListener('callback_query', handleStatisticCallbacks);
        bot.on('callback_query', (query) => handleStatisticCallbacks(query, bot));
        isHandlerRegistered = true;
    }

    await bot.editMessageText('Выберите действие:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: mainKeyboard
    });
};

async function handleStatisticCallbacks(query, bot) {
    const data = query.data;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    try {
        if (data === 'back_to_statistic_ru') {
            await bot.editMessageText('Выберите действие:', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: mainKeyboard
            });
        }
        else if (data === 'week_statistic') {
            const filePath = await generateStatisticFile(chatId, 'week');
            await bot.sendDocument(chatId, filePath);
            await bot.editMessageText('Статистика за неделю сгенерирована:', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: backKeyboard
            });
        }
        else if (data === 'month_statistic') {
            const filePath = await generateStatisticFile(chatId, 'month');
            await bot.sendDocument(chatId, filePath);
            await bot.editMessageText('Статистика за месяц сгенерирована:', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: backKeyboard
            });
        }
        else if (data === 'send_statistic_to_doctor') {
            const userResult = await db.query(
                'SELECT name, doctor_key FROM users WHERE chat_id = $1',
                [chatId]
            );

            if (!userResult.rows[0] || !userResult.rows[0].doctor_key) {
                await bot.editMessageText('Вы не ввели ключ врача', {
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
                await bot.editMessageText('Неверный ключ врача', {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: backKeyboard
                });
                return;
            }

            const doctorChatId = doctorQuery.rows[0].chat_id;
            const filePath = await generateStatisticFile(chatId, 'month');

            await bot.sendDocument(doctorChatId, filePath, {
                caption: `Статистика приступов пациента ${userName} за последний месяц`
            });

            await bot.editMessageText('Статистика отправлена врачу', {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: backKeyboard
            });
        }
    } catch (error) {
        console.error('Ошибка при обработке статистики:', error);
        await bot.editMessageText('Произошла ошибка', {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: backKeyboard
        });
    }
}