const nome = document.getElementById("nome");
const personagem = document.getElementById("personagem");
const avatares = document.querySelectorAll(".avatar");
const loadingStatus = document.getElementById("loading-status");
const btnFoto = document.getElementById("btn-foto");
const btnBaixar = document.getElementById("btn-baixar");
const btnTentar = document.getElementById("btn-tentar");
const toast = document.getElementById("toast");

// ---------- Trocar personagem ----------
function selecionar(avatar) {
    avatares.forEach((a) => {
        a.classList.remove("ativo");
        a.setAttribute("aria-pressed", "false");
    });
    avatar.classList.add("ativo");
    avatar.setAttribute("aria-pressed", "true");

    nome.textContent = avatar.dataset.nome;
    nome.style.color = avatar.dataset.cor;
    personagem.src = avatar.src;
    personagem.alt = avatar.dataset.nome;
    personagem.classList.remove("foto-usuario", "gerando");
    esconderAcoes();
    pedidoAtual++; // cancela qualquer geração da IA em andamento
    pararLoading();
}

avatares.forEach((avatar) => {
    avatar.addEventListener("click", () => selecionar(avatar));
    // acessibilidade: Enter e Espaço também escolhem o personagem
    avatar.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter" || evento.key === " ") {
            evento.preventDefault();
            selecionar(avatar);
        }
    });
});

// ---------- Avisos na tela (em vez de alert) ----------
let tempoToast = null;

function mostrarToast(mensagem, duracao = 5000) {
    toast.textContent = mensagem;
    toast.hidden = false;
    // reinicia a animação de entrada
    toast.classList.remove("mostrar");
    void toast.offsetWidth;
    toast.classList.add("mostrar");

    clearTimeout(tempoToast);
    tempoToast = setTimeout(() => (toast.hidden = true), duracao);
}

// ---------- Foto do usuário ----------
const modal = document.getElementById("modal");
const modalCamera = document.getElementById("modal-camera");
const inputGaleria = document.getElementById("input-galeria");
const video = document.getElementById("video");
let stream = null;

btnFoto.addEventListener("click", () => {
    modal.hidden = false;
    document.getElementById("opcao-galeria").focus();
});

function fecharModalFoto() {
    modal.hidden = true;
    btnFoto.focus(); // devolve o foco para o botão que abriu o menu
}

document.getElementById("modal-fechar").addEventListener("click", () => fecharModalFoto());

// fecha os modais clicando no fundo escuro ou com a tecla Esc
modal.addEventListener("click", (evento) => {
    if (evento.target === modal) fecharModalFoto();
});

modalCamera.addEventListener("click", (evento) => {
    if (evento.target === modalCamera) fecharCamera();
});

document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
        if (!modal.hidden) fecharModalFoto();
        fecharCamera();
    }

    // prende o foco dentro do modal aberto: Tab e Shift+Tab circulam pelos botões
    if (evento.key === "Tab") {
        const aberto = !modal.hidden ? modal : !modalCamera.hidden ? modalCamera : null;
        if (!aberto) return;

        const focaveis = [...aberto.querySelectorAll("button:not([hidden])")];
        if (!focaveis.length) return;

        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];

        if (evento.shiftKey && document.activeElement === primeiro) {
            evento.preventDefault();
            ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
            evento.preventDefault();
            primeiro.focus();
        }
    }
});

// Galeria
document.getElementById("opcao-galeria").addEventListener("click", () => {
    modal.hidden = true;
    inputGaleria.click();
});

inputGaleria.addEventListener("change", () => {
    const arquivo = inputGaleria.files[0];
    if (arquivo) {
        if (!arquivo.type.startsWith("image/")) {
            mostrarToast("Escolha um arquivo de imagem (PNG ou JPG).");
        } else if (arquivo.size > 10 * 1024 * 1024) {
            mostrarToast("A foto é muito grande. Use uma imagem de até 10 MB.");
        } else {
            usarFoto(arquivo);
        }
    }
    inputGaleria.value = "";
});

// Câmera
document.getElementById("opcao-camera").addEventListener("click", async () => {
    modal.hidden = true;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
        });
        video.srcObject = stream;
        modalCamera.hidden = false;
        document.getElementById("tirar-foto").focus();
    } catch (erro) {
        console.error(erro);
        stream = null;
        if (erro.name === "NotAllowedError" || erro.name === "SecurityError") {
            mostrarToast("A câmera está bloqueada. Clique no ícone de câmera na barra de endereço, escolha Permitir e recarregue a página.", 8000);
        } else if (erro.name === "NotFoundError") {
            mostrarToast("Não encontrei nenhuma câmera neste dispositivo.", 8000);
        } else if (erro.name === "NotReadableError") {
            mostrarToast("A câmera está sendo usada por outro programa. Feche-o e tente de novo.", 8000);
        } else {
            mostrarToast("Não consegui acessar a câmera. Verifique a permissão do navegador.", 8000);
        }
    }
});

function fecharCamera() {
    const estavaAberta = !modalCamera.hidden;

    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    modalCamera.hidden = true;

    if (estavaAberta) btnFoto.focus();
}

document.getElementById("camera-fechar").addEventListener("click", () => fecharCamera());

document.getElementById("tirar-foto").addEventListener("click", () => {
    // só captura depois que a câmera mostrou o primeiro frame
    if (!video.videoWidth || !video.videoHeight) {
        mostrarToast("A câmera ainda não está pronta. Tente de novo em um instante.");
        return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
        fecharCamera();
        if (blob) {
            usarFoto(blob);
        } else {
            mostrarToast("Não consegui capturar a foto. Tente de novo.");
        }
    }, "image/jpeg", 0.9);
});

// ---------- Usar a foto ----------
let pedidoAtual = 0; // evita que uma resposta antiga da IA sobrescreva uma escolha mais nova
let ultimaFoto = null; // guarda a foto para o botão "Tentar de novo"

function esconderAcoes() {
    btnBaixar.hidden = true;
    btnTentar.hidden = true;
}

async function usarFoto(arquivo) {
    const pedido = ++pedidoAtual;
    ultimaFoto = arquivo;
    btnFoto.classList.add("usada"); // o pulso de atenção só aparece até a primeira foto

    avatares.forEach((a) => {
        a.classList.remove("ativo");
        a.setAttribute("aria-pressed", "false");
    });
    nome.style.color = "#ffd319";
    esconderAcoes();

    // Enquanto a IA trabalha: esconde o personagem e mostra só "Loading..."
    personagem.classList.add("gerando");
    iniciarLoading();

    try {
        const versaoGta = await gerarVersaoGta(arquivo);

        // Se a pessoa clicou em outro personagem/foto no meio do caminho, ignora
        if (pedido !== pedidoAtual) return;

        pararLoading();
        nome.textContent = "Você";
        personagem.classList.remove("foto-usuario");
        personagem.src = versaoGta;
        personagem.alt = "Você em versão GTA";
        btnBaixar.hidden = false;
        btnTentar.hidden = true;
    } catch (erro) {
        console.error(erro);
        if (pedido !== pedidoAtual) return;

        // Deu erro: mostra a foto original no lugar
        pararLoading();
        nome.textContent = "Você";
        personagem.classList.add("foto-usuario");
        const urlOriginal = URL.createObjectURL(arquivo);
        personagem.addEventListener("load", () => URL.revokeObjectURL(urlOriginal), { once: true });
        personagem.src = urlOriginal;
        personagem.alt = "Sua foto original";
        btnTentar.hidden = false;
        mostrarToast("Não consegui gerar a versão GTA (" + mensagemDeErro(erro) + "). Mostrei a sua foto original. Dica: tente de novo com uma foto clara e bem iluminada.", 9000);
    } finally {
        if (pedido === pedidoAtual) personagem.classList.remove("gerando");
    }
}

function mensagemDeErro(erro) {
    if (!erro) return "erro desconhecido";
    if (typeof erro === "string") return erro;
    return erro.error?.message || erro.message || JSON.stringify(erro);
}

// ---------- Tentar de novo com a mesma foto ----------
btnTentar.addEventListener("click", () => {
    if (ultimaFoto) {
        usarFoto(ultimaFoto);
    } else {
        modal.hidden = false;
        document.getElementById("opcao-galeria").focus();
    }
});

// ---------- Baixar o personagem gerado ----------
btnBaixar.addEventListener("click", async () => {
    const url = personagem.src;
    if (!url) return;

    const salvar = (endereco) => {
        const link = document.createElement("a");
        link.href = endereco;
        link.download = "meu-personagem-gta.png";
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    // imagem em base64 ou blob local: baixa direto
    if (url.startsWith("data:") || url.startsWith("blob:")) {
        salvar(url);
        return;
    }

    // imagem gerada pela IA: busca o arquivo para poder salvar
    try {
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error("falha no download");
        const blob = await resposta.blob();
        const urlLocal = URL.createObjectURL(blob);
        salvar(urlLocal);
        setTimeout(() => URL.revokeObjectURL(urlLocal), 4000);
    } catch {
        // se não der para baixar em segundo plano, abre a imagem em outra aba
        window.open(url, "_blank");
    }
});

// ---------- Texto "Loading..." ----------
let intervaloLoading = null;
let intervaloMensagens = null;

const mensagemLoading = loadingStatus.querySelector("p");
const mensagensLoading = [
    "✨ Transformando sua foto em personagem GTA...",
    "🎨 Desenhando os contornos grossos...",
    "🌴 Ajustando as cores neon...",
    "🎮 Finalizando o seu personagem...",
];

function iniciarLoading() {
    pararLoading();
    nome.classList.add("carregando");
    loadingStatus.hidden = false;

    let pontos = 0;
    nome.textContent = "Loading";
    intervaloLoading = setInterval(() => {
        pontos = (pontos + 1) % 4;
        nome.textContent = "Loading" + ".".repeat(pontos);
    }, 400);

    // troca a mensagem de baixo de tempos em tempos para o espera não ficar parada
    let indice = 0;
    mensagemLoading.textContent = mensagensLoading[0];
    intervaloMensagens = setInterval(() => {
        indice = (indice + 1) % mensagensLoading.length;
        mensagemLoading.textContent = mensagensLoading[indice];
    }, 4500);
}

function pararLoading() {
    clearInterval(intervaloLoading);
    clearInterval(intervaloMensagens);
    intervaloLoading = null;
    intervaloMensagens = null;
    nome.classList.remove("carregando");
    loadingStatus.hidden = true;
}

// ---------- Ligação com a IA (Puter.js) ----------
function arquivoParaDataURL(arquivo) {
    return new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(leitor.result);
        leitor.onerror = () => reject(new Error("Falha ao ler a foto"));
        leitor.readAsDataURL(arquivo);
    });
}

async function gerarVersaoGta(arquivo) {
    if (typeof puter === "undefined" || !puter.ai?.txt2img) {
        throw new Error("o serviço de IA não está disponível. Verifique sua conexão e tente de novo");
    }

    const fotoEmUrl = await arquivoParaDataURL(arquivo);

    const desenho = await puter.ai.txt2img(
        "Transforme a pessoa desta foto em um personagem de GTA V/VI estilo arte de capa de jogo: contorno preto grosso e definido, cores vivas e saturadas, iluminação dramática, estilo semi-realista com toque de arte digital, meio corpo, mantendo as características faciais e expressão da pessoa. Fundo totalmente transparente: sem cenário, sem chão e sem sombra. Estilo artístico similar às artes promocionais do GTA com traços marcantes e cores neon.",
        {
            model: "replicate:openai/gpt-image-2.5-flare",
            provider: "openai",
            input_image: fotoEmUrl,
            quality: "high",
            size: "1024x1024",
            providerOptions: { background: "transparent" }
        }
    );

    return desenho.src; // txt2img devolve um <img>; pegamos o link dele
}
