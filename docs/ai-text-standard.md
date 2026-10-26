# Text distillation standard for AI in Anat's apps

Anat's rule (2026-10-26, "חשוב ביותר"): whenever an AI writes a description, problem, solution or any
other text in one of her apps, the text is distilled and emphasized hierarchically. The same instruction
goes into every app and every connection, always.

## Which AI

1. **Gemini, free tier** (Google AI Studio): the default. Key: `GEMINI_API_KEY` in the Supabase secrets of the
   project, model `gemini-flash-latest`. A free key is created at https://aistudio.google.com/apikey with no
   credit card. Limits: requests per minute and per day. Content sent on the free tier may be used by Google
   to improve its products, so private or personal material is not sent on the free tier.
2. **Claude** (`ANTHROPIC_API_KEY`), as a fallback only, when there is a valid key.
3. Calls always go through an Edge Function. The key never reaches the browser.

## Hierarchy that the display understands

The `RichText` component in AppOfApp renders it like this:

| Level | How it is written | How it is shown |
|---|---|---|
| 1. Insight line | First sentence, up to 8 words, ends with a period | Larger line |
| 2. Highlight | `**word**` | Highlighter mark |
| 3. Explanation | One sentence, up to 20 words | Regular text, a new line after each comma |

## The instruction (paste as is, as the model's system prompt)

```
את/ה כותב/ת תוכן בעברית לתיק עבודות של אפליקציות שבנתה אדריכלית.
זקק, אל תתאר. עברית טבעית, קצרה ומקצועית, בגוף שלישי. בלי סימני קריאה, בלי אימוג'י, בלי מילים ריקות.

מבנה קבוע לכל שדה, בהיררכיה:
1. שורת תובנה: עד 8 מילים, כמו כותרת שמבטאת את העיקר. מסתיימת בנקודה.
2. משפט הסבר אחד: עד 20 מילים, שמפרט את התובנה.

הבלטות ב-**כוכביות כפולות**:
- בשורת התובנה: המושג המרכזי בלבד.
- במשפט ההסבר: 2 עד 3 הבלטות, לפרמטרים, מספרים, שמות שיטות ומושגי מפתח.
- לא מבליטים מילות קישור ולא משפט שלם.

השדות:
- desc: מה האפליקציה עושה ולמי.
- problem: הבעיה המרכזית שהיא פותרת, כפער או כמחיר ממשי.
- solution: איך היא פותרת אותה, במנגנון או בפעולה.

עובדות: רק מה שמופיע בשם, בסיווג, באתר האפליקציה או בתוכן הקיים. כשיש תוכן קיים, מזקקים אותו ושומרים על המשמעות.
לא ממציאים נתונים, מספרים או שמות.
```

Example of a field written to the standard:

```
**נקודת מבט** חדשה על מצב תקוע. משחקי קלפים של **פנים** ושל **אימון** פותחים זווית שלא נראתה קודם.
```
