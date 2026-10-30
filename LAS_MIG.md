# Project HQ 4.54 – Clean Slate

Starta på Windows med **STARTA_HQ.bat**. Den här versionen börjar utan några projekt.

- Skapa ett eget projekt via **Nytt projekt**. Artist är en generell projektmall, inte en förifylld artistprofil.
- I ett Artist-projekt kan du lägga till Spotify, YouTube, Instagram och TikTok, antingen profil-URL eller (för faktisk API-statistik) godkända API-uppgifter. Spotify visar artistföljare, inte månatliga lyssnare.
- En profil-URL i sig innebär **inte** att följarsiffror kan hämtas. Manuell inmatning märks tydligt.
- AI-agentroller svarar först när du har anslutit Ollama Cloud och själv skickar ett meddelande. Ingen automatisk outreach eller övervakning.
- Trading är ett verktyg i sidomenyn. Auto Sound Design finns kvar som separat arbetsyta med liten HQ-knapp.
- Dina tidigare installationer och gamla projekt rörs inte. Den nya versionen importerar inte gamla projekt.

## Privat användning och GitHub
Lokala projektdata finns i mappen `data/` intill startfilen när HQ körs. API-nycklar sparas i `integrations.private.json` eller `clean-slate-social.private.json`. Ladda **aldrig upp** dessa på GitHub. `.gitignore` exkluderar hela mappen `data/`. Ett privat GitHub-repository ger inte automatiskt säker kryptering av API-nycklar på datorn.
