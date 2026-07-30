# 🚀 Deploy ProFlow to Vercel (Free)

Deploying takes **2 minutes** and gives you a live URL anyone can access.

### Option 1: One-click deploy (requires GitHub)

1. Push this project to a GitHub repository
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repo
4. Vercel auto-detects Next.js — click **Deploy**
5. Done! Your URL will be something like `proflow-xxx.vercel.app`

### Option 2: CLI deploy (any machine)

1. Install the Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Log in to your Vercel account:
   ```bash
   vercel login
   ```
   (Opens a browser — sign in with GitHub, Google, or email)

3. Deploy from the project folder:
   ```bash
   cd C:\Users\parth\Desktop\Python\pro-flow
   vercel --prod
   ```

4. Follow the prompts:
   - **Set up and deploy?** → `Y`
   - **Which scope?** → select your account
   - **Link to existing project?** → `N`
   - **Project name?** → `proflow` (or any name)
   - **Directory?** → `.` (current directory)
   - **Auto-detect?** → Vercel will detect Next.js automatically

5. Wait ~60 seconds for the build. Your live URL will appear:
   ```
   ✅  Production: https://proflow-xxx.vercel.app [now]
   ```

### Option 3: Windows batch script

Double-click `deploy.bat` in the project folder — it will run the CLI steps above
(after you've run `vercel login` once).

---

## After deploying

- **Your data is private** — each visitor's localStorage is isolated in their browser
- **No backend needed** — this is a fully client-side app
- **To update**: run `vercel --prod` again from the project folder
