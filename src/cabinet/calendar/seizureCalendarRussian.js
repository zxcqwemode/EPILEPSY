const db = require('../../config/db');

// Функция для рендеринга календаря
async function seizureCalendarRussian(bot, chatId, messageId, monthOffset = 0) {
    try {
        const today = new Date();
        const currentMonth = today.getMonth() + monthOffset;
        const currentYear = today.getFullYear();

        // Получаем количество дней в месяце
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        // Получаем записи для календаря из базы данных
        const result = await db.query(`
            SELECT * FROM calendar WHERE user_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3
        `, [chatId, currentMonth + 1, currentYear]);

        const calendarData = result.rows;

        // Создание кнопок для дней месяца
        const inlineKeyboard = [];
        let row = [];
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
        const dayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

        // Кнопка с названием месяца
        inlineKeyboard.push([
            {
                text: `${new Date(currentYear, currentMonth).toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}`,
                callback_data: 'no_action'
            }
        ]);

        // Кнопки для дней недели
        const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        inlineKeyboard.push(weekDays.map(day => ({ text: day, callback_data: 'no_action' })));

        // Пустые кнопки до первого числа
        for (let i = 0; i < dayOfWeek; i++) {
            row.push({ text: ' ', callback_data: 'no_action' });
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayRecord = calendarData.find(entry => new Date(entry.date).getDate() === day);
            let buttonLabel = `${day}`;

            // Добавляем метки в зависимости от записей
            if (dayRecord) {
                if (dayRecord.had_seizure && dayRecord.medications) {
                    buttonLabel += ' 🔺';  // Приступ с медикаментами
                } else if (dayRecord.had_seizure && !dayRecord.medications) {
                    buttonLabel += ' 🔸';  // Приступ без медикаментов
                } else if (dayRecord.note) {
                    buttonLabel += ' ✅';  // Заметка
                }
            }

            row.push({ text: buttonLabel, callback_data: `calendar_${day}_${monthOffset}` });

            if (row.length === 7) {
                inlineKeyboard.push(row);
                row = [];
            }
        }

        // Заполняем оставшиеся дни пустыми кнопками
        while (row.length < 7) {
            row.push({ text: ' ', callback_data: 'no_action' });
        }
        if (row.length) {
            inlineKeyboard.push(row);
        }

        // Кнопки навигации по месяцам
        const navigationRow = [];
        navigationRow.push({ text: '⬅️', callback_data: `change_month_${monthOffset - 1}` });

        // Проверка, можем ли двигаться вправо
        if (currentMonth < today.getMonth()) {
            navigationRow.push({ text: '➡️', callback_data: `change_month_${monthOffset + 1}` });
        } else {
            navigationRow.push({ text: '➡️', callback_data: 'no_action' }); // Неактивная кнопка
        }

        inlineKeyboard.push(navigationRow);

        // Кнопка "Назад в профиль"
        inlineKeyboard.push([
            { text: 'Назад в профиль', callback_data: 'back_to_profile' }
        ]);

        // Редактируем предыдущее сообщение с календарем
        await bot.editMessageText(
            `Ваш календарь приступов\n\nЕсли в календаре уже есть запись, то значок покажет, был ли у вас приступ:\n🔸 — Приступ без приема препаратов\n🔺 — Приступ с препаратами`,
            {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: inlineKeyboard
                }
            }
        );
    } catch (error) {
        console.error('Ошибка при рендеринге календаря:', error);
    }
}

// Обработчик изменения месяца
async function handleChangeMonthRussian(bot, chatId, monthOffset, messageId) {
    await seizureCalendarRussian(bot, chatId, messageId, monthOffset);
}

module.exports = {
    seizureCalendarRussian,
    handleChangeMonthRussian
};
