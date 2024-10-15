
module.exports = async function informationEnglish(bot, chatId) {
    const informationMessage = `
**Information About Epilepsy:**

Epilepsy is a neurological disorder that affects people of all ages. It is characterized by recurrent seizures that can vary in severity and duration. Seizures occur when there is a sudden burst of electrical activity in the brain, leading to changes in behavior, movements, feelings, or levels of consciousness.

**Key Points:**
- Epilepsy can be caused by brain injury, genetic factors, or it may have no identifiable cause.
- Treatment often includes medications that can help control seizures.
- It is important to work closely with healthcare providers to find the right treatment plan.

If you have any concerns or questions about epilepsy, please consult your doctor.

`;

    // Определяем кнопку "Назад"
    const backOptions = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Back', callback_data: 'back_to_profile' },
                ],
            ],
        },
    };

    // Отправляем информацию о заболевании и кнопку "Назад"
    await bot.sendMessage(chatId, informationMessage, backOptions);
};
