# תקן כפתור הלוגו A&I

כל אפליקציה של אד' ענת שטיבלמן מציגה בסרגל העליון כפתור לוגו אחד: הסימן A&I והשם "אד' ענת שטיבלמן".
כל מה שקשור לבנייה, לפיתוח ולעריכה של האפליקציה נמצא בתוכו, ולא כפתורים נפרדים בסרגל:

- עריכת האפליקציה: מצב עריכה, הוספה, מחיקה, ניסוח, חיבור וניתוק של מכשיר עריכה.
- שיתוף ופיתוח: העתקת קישור למצב הנוכחי, שיחת הפיתוח, פרויקט המחקר, התקנת האפליקציה.

בסרגל עצמו נשארים רק: שם האפליקציה (קישור לדף הבית), חיפוש וניווט תוכן, וכפתור הלוגו.

## מימוש: שורה אחת, לא הוראה

הרכיב הוא קובץ אחד שמתארח באפליקציית האם:
https://appofapp-gh.vercel.app/ai-menu.js
(מקור: `public/ai-menu.js` בריפו AppOfApp-GH). שינוי בקובץ מתעדכן בכל האפליקציות.

```html
<script src="https://appofapp-gh.vercel.app/ai-menu.js"></script>
<ai-menu chat="https://claude.ai/code/session_..." research="https://claude.ai/project/..."></ai-menu>
```

באתר בלי סרגל עליון:

```html
<script src="https://appofapp-gh.vercel.app/ai-menu.js" data-auto data-chat="https://claude.ai/code/session_..."></script>
```

פעולות העריכה של האפליקציה נכנסות לכפתור כך:

```js
const menu = document.querySelector('ai-menu');
menu.items = [
  { label: 'מצב עריכה', pressed: editing, onSelect: () => toggleEditing() },
  { label: 'אפליקציה חדשה', onSelect: () => openAdd() },
];
menu.status = 'נשמר'; // מצב קצר מתחת לשם
```

ב-React: `src/components/AIMenu.tsx` בריפו הזה.

## בדיקה שחוסמת מסירה

בכל בדיקת Playwright של אפליקציה:

```js
ok(await page.locator('ai-menu .logo').isVisible(), 'A&I logo button in the top bar');
ok(!(await page.locator('header >> text=העתקת קישור').first().isVisible().catch(() => false)), 'no loose development buttons in the bar');
```

## נוסח להדבקה

### בהעדפות האישיות ב-claude.ai (Settings, Profile), במקום השורה על הסרגל העליון

```
- בכל אפליקציה: סרגל ניווט עליון קבוע בכל הדפים. שם האפליקציה מקשר לדף הבית. בסרגל רק ניווט תוכן וכפתור לוגו אחד "אד' ענת שטיבלמן A&I". כל כפתורי העריכה והפיתוח (העתקת קישור, שיחת הפיתוח, פרויקט המחקר, התקנת האפליקציה, מצב עריכה, הוספה, מחיקה) נמצאים רק בתוך כפתור הלוגו, אף פעם לא כפתורים נפרדים. מימוש: <script src="https://appofapp-gh.vercel.app/ai-menu.js"></script> ו-<ai-menu>. תקן מלא: github.com/Anat1969/AppOfApp-GH/blob/main/docs/ai-menu-standard.md
```

### בסקיל end-to-end-builder, במקום סעיף 7 עד "פרויקט המחקר"

```
7. **רכיבים קבועים בכל אפליקציה**:
   - סרגל ניווט עליון קבוע בכל הדפים, גם בעמודים פנימיים ובחלונות העמקה (הם נפתחים מתחתיו, לא מעליו).
   - שם האפליקציה הוא קישור לדף הבית. יש דף בית אמיתי שממפה את התוכן.
   - **כפתור לוגו "אד' ענת שטיבלמן A&I" הוא הכפתור היחיד בסרגל שאינו ניווט תוכן.** בתוכו, ורק בתוכו: העתקת קישור (למצב הנוכחי), שיחת הפיתוח, פרויקט המחקר, התקנת האפליקציה, וכל פעולות העריכה (מצב עריכה, הוספה, מחיקה, ניסוח, חיבור מכשיר). אין פס עריכה צף ואין כפתורים אלה בסרגל.
   - מימוש חובה, לא כתיבה מחדש: `<script src="https://appofapp-gh.vercel.app/ai-menu.js"></script>` ו-`<ai-menu chat="..." research="...">`. פעולות העריכה נכנסות דרך `menu.items`. תקן: github.com/Anat1969/AppOfApp-GH/blob/main/docs/ai-menu-standard.md
   - בדיקת Playwright חובה: `ai-menu .logo` גלוי, ואין "העתקת קישור" כפתור חופשי בסרגל. בלי זה אין מסירה.
```

### בכל סקיל אחר של בניית אפליקציה (master-app-builder, base44-developer, app-pic-build-cluade, dynamic-intuitive-app-architecture, ai-product-designer)

```
## כפתור הלוגו A&I (חובה בכל אפליקציה)
בסרגל העליון כפתור לוגו אחד "אד' ענת שטיבלמן A&I". כל כפתורי העריכה והפיתוח (העתקת קישור, שיחת הפיתוח, פרויקט המחקר, התקנה, מצב עריכה, הוספה, מחיקה) נמצאים רק בתוכו. מימוש: <script src="https://appofapp-gh.vercel.app/ai-menu.js"></script> ו-<ai-menu>. ב-Base44 או בכלי שלא מאפשר סקריפט חיצוני: לבנות כפתור זהה לפי github.com/Anat1969/AppOfApp-GH/blob/main/docs/ai-menu-standard.md
```

## Municipal apps (2026-10-27)

Apps that belong to Ashdod Municipality show the municipality logo instead of the A&I mark. Same component, same menu:

```html
<ai-menu brand="ashdod" chat="..." research="..."></ai-menu>
```

At the start of every build, ask Anat whose app it is (municipality or hers) and record it in the repo's CLAUDE.md under "בעלות ולוגו".
