import { execSync } from "node:child_process";

/**
 * Esegue un comando git e restituisce l'output come stringa
 * @param {string} command 
 * @returns {string}
 */
function git(command) {
  try {
    return execSync(command, { encoding: "utf8" }).trim();
  } catch (err) {
    // Restituiamo l'errore per gestirlo esternamente se necessario
    return (err.stdout || err.stderr || "").toString();
  }
}

try {
  console.log("📝 Verifico lo stato dei file...");
  
  // 1. Aggiungiamo i file
  execSync("git add .", { stdio: "inherit" });

  // 2. Controlliamo se ci sono modifiche nell'area di stage
  // --porcelain rende l'output facile da parsare per gli script
  const changes = git("git status --porcelain");

  if (!changes) {
    console.log("⚠️  Nessun cambiamento rilevato. Salto il commit.");
  } else {
    console.log("💬 Commit automatico...");
    // Usiamo stdio inherit qui per vedere il progresso del commit nel terminale
    execSync('git commit -m "Aggiornamento automatico"', { stdio: "inherit" });
  }

  // 3. Pushiamo sempre (nel caso ci siano commit locali non ancora inviati)
  console.log("📤 Push su GitHub...");
  execSync("git push", { stdio: "inherit" });

  console.log("✅ Operazione completata!");
} catch (err) {
  console.error("❌ Errore critico durante l'operazione:");
  // Evitiamo di stampare l'intero oggetto errore che è illeggibile
  console.error(err.message);
  process.exit(1);
}