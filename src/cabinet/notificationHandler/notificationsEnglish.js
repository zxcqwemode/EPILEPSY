// const db = require('../../config/db');
//
// class NotificationsEnglish {
//     constructor(bot) {
//         this.bot = bot;
//         this.timeRanges = {
//             morning: Array.from({length: 6}, (_, i) => i + 6), // 6-11
//             day: Array.from({length: 6}, (_, i) => i + 12),    // 12-17
//             evening: Array.from({length: 6}, (_, i) => i + 18)  // 18-23
//         };
//         // Add state management for user inputs
//         this.pendingNotifications = new Map();
//     }
//
//     async notificationsEnglish(chatId, messageId) {
//         const notifications = await this.getUserNotifications(chatId);
//
//         const keyboard = notifications.length === 0
//             ? [
//                 [{text: 'Add New', callback_data: 'add_notification_english'}],
//                 [{text: '🔙 Back to Profile', callback_data: 'back_to_profile'}]
//             ]
//             : notifications.length < 9
//                 ? [
//                     [
//                         {text: 'Add New', callback_data: 'add_notification_english'},
//                         {text: 'View List', callback_data: 'view_notifications_english'}
//                     ],
//                     [{text: 'Edit Reminder', callback_data: 'edit_notifications_select_english'}],
//                     [{text: '🔙 Back to Profile', callback_data: 'back_to_profile'}]
//                 ]
//                 : [
//                     [{text: 'View List', callback_data: 'view_notifications_english'}],
//                     [{text: 'Edit Reminder', callback_data: 'edit_notifications_select_english'}],
//                     [{text: '🔙 Back to Profile', callback_data: 'back_to_profile'}]
//                 ];
//
//         const options = {
//             chat_id: chatId,
//             message_id: messageId,
//             reply_markup: {inline_keyboard: keyboard}
//         };
//
//         const messageText = notifications.length === 0
//             ? 'You currently have: 0 reminders.'
//             : `You currently have set: ${notifications.length} reminder(s)`;
//
//         await this.bot.editMessageText(messageText, options);
//     }
//
//     async handleViewNotificationsEnglish(bot, chatId, messageId) {
//         try {
//             const notifications = await this.getUserNotifications(chatId);
//
//             const notificationsList = notifications.map((notification, index) =>
//                 `Reminder ${index + 1}: ${notification.medication}, ${notification.dose} at ${notification.notification_time}`
//             ).join('\n');
//
//             const options = {
//                 chat_id: chatId,
//                 message_id: messageId,
//                 reply_markup: {
//                     inline_keyboard: [
//                         [{text: '🔙 Back', callback_data: 'notifications_english'}]
//                     ]
//                 }
//             };
//
//             await bot.editMessageText(notificationsList || 'No reminders', options);
//         } catch (error) {
//             console.error('Error viewing notifications:', error);
//         }
//     }
//
//     async handleEditNotificationsSelectEnglish(bot, chatId, messageId) {
//         try {
//             const notifications = await this.getUserNotifications(chatId);
//
//             const notificationsKeyboard = notifications.map((notification, index) => [{
//                 text: `Reminder ${index + 1}: ${notification.medication}, ${notification.dose} at ${notification.notification_time}`,
//                 callback_data: `select_notification_${notification.id}_english`
//             }]);
//
//             notificationsKeyboard.push([{text: '⬅️ Back', callback_data: 'notifications_english'}]);
//
//             const options = {
//                 chat_id: chatId,
//                 message_id: messageId,
//                 reply_markup: {inline_keyboard: notificationsKeyboard}
//             };
//
//             await bot.editMessageText('Select the reminder you want to edit:', options);
//         } catch (error) {
//             console.error('Error selecting notifications to edit:', error);
//         }
//     }
//
//     async handleNotificationOptionsEnglish(bot, chatId, messageId, notificationId) {
//         const options = {
//             chat_id: chatId,
//             message_id: messageId,
//             reply_markup: {
//                 inline_keyboard: [
//                     [
//                         {text: 'Edit', callback_data: `edit_notification_${notificationId}_english`},
//                         {text: 'Delete', callback_data: `delete_notification_${notificationId}_english`}
//                     ],
//                     [{text: '⬅️ Back', callback_data: 'edit_notifications_select_english'}]
//                 ]
//             }
//         };
//
//         await bot.editMessageText('Choose an action:', options);
//
//         bot.on('callback_query', async (callbackQuery) => {
//             const data = callbackQuery.data;
//
//             if (data === `edit_notification_${notificationId}_english`) {
//                 const deleted = await this.deleteNotification(notificationId);
//
//                 if (deleted) {
//                     await bot.editMessageText('Reminder deleted. Let\'s create a new one!', {
//                         chat_id: chatId,
//                         message_id: messageId,
//                     });
//
//                     await this.handleAddNotificationEnglish(bot, chatId, messageId, 'time');
//                 } else {
//                     await bot.editMessageText('Failed to delete reminder. Please try again.', {
//                         chat_id: chatId,
//                         message_id: messageId,
//                         reply_markup: {
//                             inline_keyboard: [
//                                 [{text: 'Back to Reminders', callback_data: 'notifications_english'}]
//                             ]
//                         }
//                     });
//                 }
//             }
//         });
//     }
//
//     async deleteNotification(notificationId) {
//         try {
//             const query = 'DELETE FROM notifications WHERE id = $1';
//             await db.query(query, [notificationId]);
//             return true;
//         } catch (error) {
//             console.error('Error deleting notification:', error);
//             return false;
//         }
//     }
//
//     async handleAddNotificationEnglish(bot, chatId, messageId, step = 'time', dayPeriod = null) {
//         let options = {
//             chat_id: chatId,
//             message_id: messageId,
//             reply_markup: {inline_keyboard: []}
//         };
//
//         let messageText = '';
//
//         switch (step) {
//             case 'time':
//                 options.reply_markup.inline_keyboard = [
//                     [
//                         {text: 'Morning', callback_data: 'notification_time_morning_english'},
//                         {text: 'Day', callback_data: 'notification_time_day_english'},
//                         {text: 'Evening', callback_data: 'notification_time_evening_english'}
//                     ],
//                     [{text: '⬅️ Back', callback_data: 'notifications_english'}]
//                 ];
//                 messageText = 'What time should the reminder be set for?';
//                 break;
//
//             case 'exact_time':
//                 const timeButtons = this.generateTimeButtons(dayPeriod);
//                 options.reply_markup.inline_keyboard = [
//                     ...timeButtons,
//                     [{text: '⬅️ Back', callback_data: 'add_notification_english'}]
//                 ];
//                 messageText = 'Select the exact time:';
//                 break;
//
//             case 'medication':
//                 options.reply_markup.inline_keyboard = this.generateMedicationKeyboard();
//                 messageText = 'Choose the medication name';
//                 break;
//
//             case 'dose':
//                 options.reply_markup.inline_keyboard = [
//                     [{text: '⬅️ Back to Medications', callback_data: 'add_notification_medication_english'}]
//                 ];
//                 messageText = 'Enter the medication dose';
//                 break;
//         }
//
//         await bot.editMessageText(messageText, options);
//     }
//
//     generateTimeButtons(dayPeriod) {
//         const times = this.timeRanges[dayPeriod];
//         const buttons = [];
//         let row = [];
//
//         times.forEach(hour => {
//             row.push({
//                 text: `${hour}:00`,
//                 callback_data: `exact_time_${hour}:00_english`
//             });
//
//             if (row.length === 3) {
//                 buttons.push([...row]);
//                 row = [];
//             }
//         });
//
//         if (row.length > 0) {
//             buttons.push(row);
//         }
//
//         return buttons;
//     }
//
//     generateMedicationKeyboard() {
//         const medications = [
//             'Valproic Acid', 'Levetiracetam', 'Carbamazepine',
//             'Lamotrigine', 'Topiramate', 'Oxcarbazepine', 'Zonisamide',
//             'Ethosuximide', 'Phenobarbital', 'Perampanel', 'Lacosamide',
//             'Gabapentin', 'Pregabalin', 'Vigabatrin', 'Sultiame',
//             'Rufinamide', 'Phlebamate', 'Phenytoin', 'Clonazepam', 'Benzonal'
//         ];
//
//         const keyboard = medications.reduce((result, med, index) => {
//             const rowIndex = Math.floor(index / 2);
//             if (!result[rowIndex]) result[rowIndex] = [];
//             result[rowIndex].push({text: med, callback_data: `medication_${med}_english`});
//             return result;
//         }, []);
//
//         keyboard.push([
//             {text: 'Enter Custom Option', callback_data: 'medication_custom_english'},
//             {text: '⬅️ Back', callback_data: 'notifications_english'}
//         ]);
//
//         return keyboard;
//     }
//
//     async handleMedicationSelectionEnglish(bot, chatId, messageId, medication) {
//         this.pendingNotifications.set(chatId, {
//             ...this.pendingNotifications.get(chatId),
//             medication: medication === 'custom' ? null : medication
//         });
//
//         if (medication === 'custom') {
//             const options = {
//                 chat_id: chatId,
//                 message_id: messageId,
//                 reply_markup: {
//                     inline_keyboard: [
//                         [{text: '⬅️ Back to Medication List', callback_data: 'add_notification_medication_english'}]
//                     ]
//                 }
//             };
//             await bot.editMessageText('Enter the medication name:', options);
//         } else {
//             await this.handleAddNotificationEnglish(bot, chatId, messageId, 'dose');
//         }
//     }
//
//     async saveNotification(chatId, time, medication, dose) {
//         try {
//             const existingNotifications = await this.getUserNotifications(chatId);
//             if (existingNotifications.length >= 9) {
//                 return false;
//             }
//
//             const query = `
//                 INSERT INTO notifications (user_id, notification_time, medication, dose)
//                 VALUES ($1, $2, $3, $4)
//             `;
//             await db.query(query, [chatId, time, medication, dose]);
//
//             this.pendingNotifications.delete(chatId);
//
//             return true;
//         } catch (error) {
//             console.error('Error saving notification:', error);
//             return false;
//         }
//     }
//
//     async getUserNotifications(chatId) {
//         const query = 'SELECT * FROM notifications WHERE user_id = $1';
//         const result = await db.query(query, [chatId]);
//         return result.rows;
//     }
//
//     async completeNotificationSetupEnglish(bot, chatId, messageId) {
//         const options = {
//             chat_id: chatId,
//             message_id: messageId,
//             reply_markup: {
//                 inline_keyboard: [
//                     [{text: 'Back to Reminders', callback_data: 'notifications_english'}]
//                 ]
//             }
//         };
//
//         await bot.editMessageText('Your reminder has been set!', options);
//     }
//
//     async setupCallbackHandlerEnglish(bot) {
//         bot.on('message', async (msg) => {
//             const chatId = msg.chat.id;
//             const pendingNotification = this.pendingNotifications.get(chatId);
//
//             if (!pendingNotification) return;
//
//             if (pendingNotification.time && !pendingNotification.medication) {
//                 this.pendingNotifications.set(chatId, {
//                     ...pendingNotification,
//                     medication: msg.text
//                 });
//
//                 await bot.editMessageReplyMarkup(
//                     {inline_keyboard: []},
//                     {chat_id: chatId, message_id: msg.message_id - 1}
//                 );
//
//                 await bot.sendMessage(chatId, 'Enter the medication dose:');
//             } else if (pendingNotification.time && pendingNotification.medication) {
//                 const saved = await this.saveNotification(
//                     chatId,
//                     pendingNotification.time,
//                     pendingNotification.medication,
//                     msg.text
//                 );
//
//                 this.pendingNotifications.delete(chatId);
//
//                 if (saved) {
//                     await bot.sendMessage(chatId, 'Your reminder has been set!', {
//                         reply_markup: {
//                             inline_keyboard: [
//                                 [{text: 'Back to Reminders', callback_data: 'notifications_english'}]
//                             ]
//                         }
//                     });
//                 } else {
//                     await bot.sendMessage(chatId, 'An error occurred while saving the reminder. Please try again.', {
//                         reply_markup: {
//                             inline_keyboard: [
//                                 [{text: 'Back to Reminders', callback_data: 'notifications_english'}]
//                             ]
//                         }
//                     });
//                 }
//             }
//         });
//
//         bot.on('callback_query', async (callbackQuery) => {
//             const chatId = callbackQuery.message.chat.id;
//             const messageId = callbackQuery.message.message_id;
//             const data = callbackQuery.data;
//             if (data.startsWith('notification_time_')) {
//                 const period = data.replace('notification_time_', '').replace('_english', '');
//                 await this.handleAddNotificationEnglish(bot, chatId, messageId, 'exact_time', period);
//             } else if (data.startsWith('exact_time_')) {
//                 const selectedTime = data.replace('exact_time_', '').replace('_english', '');
//                 this.pendingNotifications.set(chatId, {
//                     time: selectedTime
//                 });
//                 await this.handleAddNotificationEnglish(bot, chatId, messageId, 'medication');
//             } else if (data.startsWith('medication_')) {
//                 const medication = data.replace('medication_', '').replace('_english', '');
//                 await this.handleMedicationSelectionEnglish(bot, chatId, messageId, medication);
//             } else if (data.startsWith('select_notification_')) {
//                 const notificationId = data.replace('select_notification_', '').replace('_english', '');
//                 await this.handleNotificationOptionsEnglish(bot, chatId, messageId, notificationId);
//             } else if (data.startsWith('delete_notification_')) {
//                 const notificationId = data.replace('delete_notification_', '').replace('_english', '');
//                 const deleted = await this.deleteNotification(notificationId);
//
//                 if (deleted) {
//                     await bot.editMessageText('Reminder deleted successfully!', {
//                         chat_id: chatId,
//                         message_id: messageId,
//                         reply_markup: {
//                             inline_keyboard: [
//                                 [{text: 'Back to Reminders', callback_data: 'notifications_english'}]
//                             ]
//                         }
//                     });
//                 } else {
//                     await bot.editMessageText('Failed to delete reminder. Please try again.', {
//                         chat_id: chatId,
//                         message_id: messageId,
//                         reply_markup: {
//                             inline_keyboard: [
//                                 [{text: 'Back to Reminders', callback_data: 'notifications_english'}]
//                             ]
//                         }
//                     });
//                 }
//             } else {
//                 switch (data) {
//                     case 'notifications_english':
//                         await this.notificationsEnglish(chatId, messageId);
//                         break;
//                     case 'add_notification_english':
//                         await this.handleAddNotificationEnglish(bot, chatId, messageId, 'time');
//                         break;
//                     case 'add_notification_medication_english':
//                         await this.handleAddNotificationEnglish(bot, chatId, messageId, 'medication');
//                         break;
//                     case 'view_notifications_english':
//                         await this.handleViewNotificationsEnglish(bot, chatId, messageId);
//                         break;
//                     case 'edit_notifications_select_english':
//                         await this.handleEditNotificationsSelectEnglish(bot, chatId, messageId);
//                         break;
//                 }
//             }
//
//             await bot.answerCallbackQuery(callbackQuery.id);
//         });
//     }
// }
//
// module.exports = {
//     NotificationsEnglish
// };