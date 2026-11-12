# قلاع المعمل

لعبة أسئلة على خريطة مصر لحد 4 لاعبين أو ضد الكمبيوتر. أسئلة معمل (تربة، خرسانة، أسفلت، ركام، وحسابات بأرقام عشوائية) وأسئلة عامة (تاريخ، فن وثقافة، جغرافيا، علوم، رياضة، حساب). اللي يجاوب صح يضم محافظة بجانب أرضه أو يهاجم محافظة منافس، والقلعة بتقع بعد 4 هجمات ناجحة.

*A browser/Android quiz game on a map of Egypt's 27 governorates, up to 4 players or vs. the computer. Plain HTML/JS, no framework; online rooms use Firebase Realtime Database over REST; Android app via Capacitor.*

## القواعد

- كل سؤال له مؤقت. اللي جاوب صح يختار محافظة بجانب أرضه.
- المحافظة الفاضية بتتضم على طول.
- لو تابعة لمنافس، الهجوم بينجح لو المنافس جاوب غلط أو جاوب أبطأ منك.
- كل لاعب عنده قلعة، وبتقع بعد 4 هجمات ناجحة وصاحبها يخرج.
- اللعبة بتخلص بعد 20 أو 30 أو 40 سؤال، أو لما تفضل قلعة واحدة. الأكتر رقع يكسب.

## التشغيل على جهازك

محتاج Node.js فقط (من غير أي مكتبات).

```bash
node tools/validate-bank.mjs   # بيتأكد إن ملف الأسئلة سليم
npm run build                  # بيطلّع www/index.html
npm run serve                  # سيرفر محلي بيقلّد Firebase: http://localhost:8099
```

افتح الرابط على أكتر من تبويب أو جهاز في نفس الشبكة وجرّب الغرف الأونلاين من غير ما تعمل مشروع Firebase.

## تفعيل اللعب الأونلاين (Firebase)

1. من [Firebase console](https://console.firebase.google.com) اعمل مشروع جديد (مش لازم Analytics).
2. من Build > Realtime Database اضغط Create Database، اختار المنطقة الأقرب، وابدأ بـ locked mode.
3. من تبويب Rules الصق محتوى `database.rules.json` وانشر.
4. انسخ رابط قاعدة البيانات (شكله `https://اسم-المشروع-default-rtdb.<منطقة>.firebasedatabase.app`) والصقه في `src/config.js` مكان `YOUR-PROJECT`.
5. `npm run build`.

ملاحظات أمان: الغرف بتتحدد بكود عشوائي من 5 حروف، ومفيش حسابات. أي حد معاه الكود يقدر يقرأ ويكتب في الغرفة دي. ده مناسب للعب بين زملاء، لكن قبل النشر العام شوف Firebase App Check وحدود الاستخدام المجاني الحالية. الغرف بتتمسح لما صاحبها يخرج، والغرف اللي اتقفلت فجأة بتفضل لحد ما تمسحها.

## نشر نسخة الويب على GitHub Pages

الملف `.github/workflows/pages.yml` بيبني ويرفع `www/` تلقائيًا. فعّله مرة واحدة من Settings > Pages > Source = GitHub Actions. نفس الرابط بيوفّر `privacy.html` اللي بتحتاجه Google Play.

## تطبيق الأندرويد (Capacitor)

مفيش حاجة من دي اتبنت أو اتجرّبت على أندرويد فعلًا، لأن بيئة الإعداد ما كانش فيها Android SDK. الملفات والأوامر جاهزة وتبدأ من عندك:

```bash
# غيّر appId في capacitor.config.json لاسم حزمة بتاعك (مثلًا com.اسمك.qalaalmamal) قبل الخطوة الجاية
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli @capacitor/assets
npm run build
npx cap add android
npm run icons            # بيولّد أيقونات وشاشة البداية من مجلد assets/
npm run android:sync
npm run android:open     # بيفتح Android Studio
```

وبعدين من Android Studio: Build > Generate Signed Bundle / APK > Android App Bundle. خطوات النشر على المتجر في [docs/PLAY_STORE.md](docs/PLAY_STORE.md).

## هيكل المشروع

```
src/app.html        الواجهة والتنسيق
src/js/01_data.js   توليد الأسئلة الحسابية العشوائية واختيار الأسئلة
src/js/02_engine.js محرك اللعبة (الأدوار، الاستيلاء، الهجوم، الكمبيوتر)
src/js/03_firebase.js غرف الأونلاين فوق Firebase REST
src/js/04_ui.js     الخريطة والشاشات وربط الشبكة
data/bank.json      بنك الأسئلة (1040 سؤال)
data/geo.json       حدود المحافظات والجيران (اتولّد بـ tools/mkmap.py)
assets/ store/      أيقونات وصور المتجر
```

## إضافة أسئلة

كل سؤال في `data/bank.json`:

```json
{ "c": "soil", "g": "lab", "q": "نص السؤال", "o": ["أ", "ب", "ج", "د"], "a": 2, "l": 2, "s": "ASTM D698" }
```

`c` الفئة (soil, concrete, asphalt, aggregate, history, arts, geography, science, sports)، `a` رقم الإجابة الصح من 0 لـ 3، `l` المستوى من 1 لـ 3، `s` المرجع. شغّل `node tools/validate-bank.mjs` بعد التعديل.

## تنبيهات مهمة

- **أسئلة المعمل محتاجة مراجعة فنية.** اتكتبت من معرفة عامة، وبعض الأرقام والشروط بتختلف حسب المواصفة والإصدار. في التطبيق شاشة "مراجعة أسئلة المعمل فنيًا" فيها زرار تعليم وتصدير CSV للأسئلة اللي فيها مشكلة. راجعها مهندس متخصص قبل التوزيع.
- **الإجابات الصح موجودة في كود الصفحة** لأن اللعبة بتشتغل كلها على الأجهزة. مناسبة للعب الودي، مش للمسابقات اللي فيها جوايز.
- **حدود المحافظات مرسومة تقريبيًا** للعبة، مش خريطة مساحية.
- اختار ترخيص للمشروع (مثلًا MIT) وأضف ملف LICENSE قبل ما تنشره.
