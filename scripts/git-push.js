import { execSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

/**
 * Esegue un comando git e restituisce l'output come stringa
 * @param {string} command
 * @returns {string}
 */
function git(command) {
  try {
    return execSync(command, { encoding: "utf8" }).trim();
  } catch (err) {
    return (err.stdout || err.stderr || "").toString();
  }
}

const rl = createInterface({ input, output });

try {
  console.log("📝 Verifico lo stato dei file...");

  // 1. Aggiunge tutti i file rispettando .gitignore
  execSync("git add -A", { stdio: "inherit" });

  // 2. Controlla se ci sono modifiche in stage
  const changes = git("git diff --cached --name-only");

  if (!changes) {
    console.log("⚠️ Nessun cambiamento rilevato. Salto il commit.");
  } else {
    console.log("\n📦 File pronti per il commit:\n");
    console.log(changes);
    console.log("");

    // 3. Gestione del Branch Corrente / Nuovo Branch
    const currentBranch = git("git branch --show-current");
    console.log(`📌 Branch attuale: ${currentBranch}`);

    if (currentBranch === "main" || currentBranch === "master") {
      console.log("⚠️ Attenzione: sei sul branch principale.");
    }

    const answer = await rl.question(
      "🔀 Vuoi creare un nuovo branch o procedere su quello attuale? [1] Nuovo branch, [2] Procedi qui (default: 2): "
    );

    if (answer.trim() === "1") {
      let branchName = "";
      while (!branchName.trim()) {
        branchName = await rl.question("🌿 Nome del nuovo branch: ");
        if (!branchName.trim()) {
          console.log("⚠️ Il nome del branch non può essere vuoto.");
        }
      }

      // Pulisce il nome del branch da spazi
      branchName = branchName.trim().replace(/\s+/g, "-");
      
      console.log(`\n🚀 Creazione e passaggio al branch: ${branchName}`);
      execSync(`git checkout -b ${branchName}`, { stdio: "inherit" });
    } else {
      console.log(`\n👉 Procedo sul branch: ${currentBranch}`);
    }

    // 4. Chiede il messaggio di commit
    let message = "";

    while (!message.trim()) {
      message = await rl.question("\n💬 Messaggio del commit: ");

      if (!message.trim()) {
        console.log("⚠️ Il messaggio non può essere vuoto.");
      }
    }

    // 5. Commit
    console.log(`\n📝 Commit: "${message.trim()}"`);
    execSync(
      `git commit -m ${JSON.stringify(message.trim())}`,
      { stdio: "inherit" }
    );

    // 6. Push (imposta automaticamente l'upstream se è un branch nuovo)
    const activeBranch = git("git branch --show-current");
    console.log(`\n📤 Push su GitHub (${activeBranch})...`);
    
    try {
      execSync("git push", { stdio: "inherit" });
    } catch {
      // Se il branch è nuovo e non esiste su remote, fa il set-upstream automatico
      console.log("\n🔄 Configuro l'upstream per il nuovo branch...");
      execSync(`git push --set-upstream origin ${activeBranch}`, { stdio: "inherit" });
    }
  }

  console.log("\n✅ Operazione completata!");
} catch (err) {
  console.error("\n❌ Errore critico durante l'operazione:");

  if (err instanceof Error) {
    console.error(err.message);
  } else {
    console.error(err);
  }

  process.exit(1);
} finally {
  rl.close();
}