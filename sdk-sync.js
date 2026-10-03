// sdk-sync.js - Sincroniza dados locais com Google Cloud
class ClassroomSync {
  constructor(projectId, apiKey) {
    this.projectId = projectId;
    this.apiKey = apiKey;
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
    this.syncQueue = [];
    this.isSyncing = false;
  }

  // Monitora mudanças no IndexedDB e localStorage
  async monitorarMudancas() {
    const db = await this.abrirDB();
    
    // Verifica a cada 30s se há dados não sincronizados
    setInterval(async () => {
      const jogosNaoSync = await this.buscarNaoSincronizados("jogos");
      const progressoNaoSync = await this.buscarNaoSincronizados("progresso_alunos");
      
      if (jogosNaoSync.length || progressoNaoSync.length) {
        await this.sincronizar();
      }
    }, 30000); // 30 segundos
  }

  async abrirDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("ClassroomGamificationDB", 3);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async buscarNaoSincronizados(storeName) {
    const db = await this.abrirDB();
    return new Promise((resolve) => {
      const tx = db.transaction([storeName], "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => {
        const dados = req.result.filter(d => !d.sincronizado);
        resolve(dados);
      };
    });
  }

  async sincronizar() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const jogos = await this.buscarNaoSincronizados("jogos");
      const progresso = await this.buscarNaoSincronizados("progresso_alunos");

      // Envia em lote
      const batch = {
        jogos: jogos,
        progresso: progresso,
        timestamp: new Date().toISOString(),
        dispositivo: this.obterDispositivo()
      };

      const response = await fetch(
        `${this.baseUrl}/sync?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(batch)
        }
      );

      if (response.ok) {
        // Marca como sincronizado
        await this.marcarComoSincronizado(jogos, progresso);
        console.log("✅ Sincronização bem-sucedida");
      }
    } catch (error) {
      console.error("❌ Erro na sincronização:", error);
      // Tenta novamente em 1 minuto
      setTimeout(() => this.sincronizar(), 60000);
    } finally {
      this.isSyncing = false;
    }
  }

  async marcarComoSincronizado(jogos, progresso) {
    const db = await this.abrirDB();
    
    // Atualiza jogos
    const txJogos = db.transaction(["jogos"], "readwrite");
    jogos.forEach(j => {
      j.sincronizado = true;
      txJogos.objectStore("jogos").put(j);
    });

    // Atualiza progresso
    const txProgresso = db.transaction(["progresso_alunos"], "readwrite");
    progresso.forEach(p => {
      p.sincronizado = true;
      txProgresso.objectStore("progresso_alunos").put(p);
    });
  }

  obterDispositivo() {
    const ua = navigator.userAgent;
    if (/Android/.test(ua)) return "Android";
    if (/iPad|iPhone/.test(ua)) return "iOS";
    if (/Windows/.test(ua)) return "Windows";
    if (/Mac/.test(ua)) return "macOS";
    if (/Linux/.test(ua)) return "Linux";
    return "Desconhecido";
  }
}

// Inicializa o SDK
const sync = new ClassroomSync("seu-projeto-gcp", "sua-api-key-aqui");
sync.monitorarMudancas();
