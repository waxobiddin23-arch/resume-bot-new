const { Telegraf, Scenes, session, Markup, Input } = require('telegraf');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const express = require('express');

// Render uchun Express server (Bot uxlab qolmasligi uchun)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Rezyume Boti ishlamoqda! 🚀');
});

app.listen(PORT, () => {
    console.log(`Server ${PORT}-portda ishga tushdi.`);
});

// Bot token va Admin ID (o'zingiznikini yozasiz)
const bot = new Telegraf('9147303966:AAGRdOoGKwxmwmU_D_PizSBaBJMThXDIA78');
const ADMIN_ID = '8763254322'; 

const usersStorage = {};

const resumeWizard = new Scenes.WizardScene(
    'RESUME_SCENE',
    async (ctx) => {
        await ctx.reply('Assalomu alaykum! Rezyume yaratish botiga xush kelibsiz.\n\nTo\'liq F.I.Sh. kiriting (Masalan: Aliyev Vali):');
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.scene.state.ism = ctx.message.text;
        await ctx.reply('Mutaxassisligingizni yozing (Masalan: Sotuvchi-menejer):');
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.scene.state.kasbi = ctx.message.text;
        await ctx.reply('Telefon raqamingizni yozing (Masalan: +998 90 123-45-67):');
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.scene.state.manzil = ctx.message.text;
        await ctx.reply('Yashash manzilingizni yozing (Masalan: Toshkent shahri):');
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.scene.state.telefon = ctx.message.text;
        await ctx.reply('Ko\'nikmalaringizni yozing (Masalan: Word, Excel, Rus tili):');
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.scene.state.konikmalar = ctx.message.text;
        await ctx.reply('Ish tajribangiz haqida yozing (Masalan: 2 yil sotuvchi bo\'lib ishlaganman):');
        return ctx.wizard.next();
    },
    async (ctx) => {
        ctx.scene.state.tajriba = ctx.message.text;
        const paymentText = `Ma'lumotlaringiz qabul qilindi! ✅\n\nRezyume narxi: **10 000 so'm**.\n\nQuyidagi karta raqamiga to'lov qiling:\n💳 \`8600 0000 0000 0000\`\n\nTo'lov qilgach, chek rasmini shu yerga yuboring.`;
        await ctx.reply(paymentText, { parse_mode: 'Markdown' });
        return ctx.wizard.next();
    },
    async (ctx) => {
        if (!ctx.message.photo) {
            await ctx.reply('Iltimos, to\'lov cheki rasmini yuboring!');
            return;
        }

        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        const userId = ctx.from.id;
        const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

        usersStorage[userId] = { ...ctx.scene.state };

        const adminMsg = `Yangi to'lov cheki keldi! 💰\nFoydalanuvchi: ${username} (ID: ${userId})`;
        await bot.telegram.sendPhoto(ADMIN_ID, photoId, {
            caption: adminMsg,
            ...Markup.inlineKeyboard([
                [Markup.button.callback('✅ Tasdiqlash', `approve_${userId}`)]
            ])
        });

        await ctx.reply('Chek qabul qilindi! ⏳ Admin tasdiqlashini kuting.');
        return ctx.scene.leave();
    }
);

const stage = new Scenes.Stage([resumeWizard]);
bot.use(session());
bot.use(stage.middleware());

bot.start((ctx) => ctx.scene.enter('RESUME_SCENE'));

bot.action(/^approve_(.+)$/, async (ctx) => {
    try {
        await ctx.answerCbQuery('PDF tayyorlanmoqda...');
    } catch (err) {}

    const userId = ctx.match[1];
    const data = usersStorage[userId];

    if (!data) {
        return ctx.reply('Xatolik: Foydalanuvchi ma\'lumotlari topilmadi.');
    }

    try {
        let htmlPath = path.join(__dirname, 'template.html');
        if (!fs.existsSync(htmlPath)) {
            return ctx.reply('Xatolik: template.html fayli topilmadi!');
        }

        let html = fs.readFileSync(htmlPath, 'utf8');
        html = html.replace('{{ISM_FAMILIYA}}', data.ism || '')
                   .replace('{{KASBI}}', data.kasbi || '')
                   .replace('{{TELEFON}}', data.telefon || '')
                   .replace('{{MANZIL}}', data.manzil || '')
                   .replace('{{KONIKMALAR}}', data.konikmalar || '')
                   .replace('{{TAJRIBA}}', data.tajriba || '');

        const browser = await puppeteer.launch({ 
            headless: true, 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'domcontentloaded' });
        
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();

        if (!pdfBuffer || pdfBuffer.length === 0) {
            throw new Error('PDF yaratilmadi yoki bo\'sh.');
        }

        await bot.telegram.sendDocument(userId, Input.fromBuffer(Buffer.from(pdfBuffer), 'Mening_Rezyumem.pdf'));

        await ctx.editMessageCaption({ caption: '✅ Tasdiqlandi va PDF mijozga yuborildi!' });
        await bot.telegram.sendMessage(userId, 'Mana sizning tayyor rezyumengiz! 🎉 Tabriklaymiz.');
    } catch (e) {
        console.error('Xatolik:', e);
        await ctx.reply('Xatolik yuz berdi: ' + e.message);
    }
});

bot.launch();
console.log('Bot Telegramda ishga tushdi!');