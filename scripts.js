const nome = document.getElementById("nome");
const personagem = document.getElementById("personagem");
const avatares = document.querySelectorAll(".avatar");
const loadingStatus = document.getElementById("loading-status");

// ---------- Trocar personagem ----------
function selecionar(avatar) {
    avatares.forEach((a) => a.classList.remove("ativo"));
    avatar.classList.add("ativo");

    nome.textContent = avatar.dataset.nome;
    nome.style.color = avatar.dataset.cor;
    personagem.src = avatar.src;
    personagem.alt = avatar.dataset.nome;
    personagem.classList.remove("foto-usuario", "gerando");
    pedidoAtual++; // cancela qualquer geração da IA em andamento
    pararLoading();
}

avatares.forEach((avatar) => {
    avatar.addEventListener("click", () => selecionar(avatar));
});

// ---------- Foto do usuário ----------
const modal = document.getElementById("modal");
const modalCamera = document.getElementById("modal-camera");
const inputGaleria = document.getElementById("input-galeria");
const video = document.getElementById("video");
let stream = null;

document.getElementById("btn-foto").addEventListener("click", () => (modal.hidden = false));
document.getElementById("modal-fechar").addEventListener("click", () => (modal.hidden = true));

// Galeria
document.getElementById("opcao-galeria").addEventListener("click", () => {
    modal.hidden = true;
    inputGaleria.click();
});

inputGaleria.addEventListener("change", () => {
    const arquivo = inputGaleria.files[0];
    if (arquivo) usarFoto(arquivo);
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
    } catch (erro) {
        console.error(erro);
        if (erro.name === "NotAllowedError" || erro.name === "SecurityError") {
            alert("A câmera está bloqueada. Clique no ícone de câmera na barra de endereço, escolha \"Permitir\" e recarregue a página.");
        } else if (erro.name === "NotFoundError") {
            alert("Não encontrei nenhuma câmera neste dispositivo.");
        } else if (erro.name === "NotReadableError") {
            alert("A câmera está sendo usada por outro programa. Feche-o e tente de novo.");
        } else {
            alert("Não consegui acessar a câmera. Verifique a permissão do navegador.");
        }
    }
});

function fecharCamera() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    modalCamera.hidden = true;
}

document.getElementById("camera-fechar").addEventListener("click", fecharCamera);

document.getElementById("tirar-foto").addEventListener("click", () => {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
        fecharCamera();
        usarFoto(blob);
    }, "image/jpeg", 0.9);
});

// ---------- Usar a foto ----------
let pedidoAtual = 0; // evita que uma resposta antiga da IA sobrescreva uma escolha mais nova

async function usarFoto(arquivo) {
    const pedido = ++pedidoAtual;

    avatares.forEach((a) => a.classList.remove("ativo"));
    nome.style.color = "#ffd319";

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
    } catch (erro) {
        console.error(erro);
        if (pedido !== pedidoAtual) return;

        // Deu erro: mostra a foto original no lugar
        pararLoading();
        nome.textContent = "Você";
        personagem.classList.add("foto-usuario");
        personagem.src = URL.createObjectURL(arquivo);
        alert(`Não consegui gerar a versão GTA (${mensagemDeErro(erro)}). Mostrei a sua foto original.\n\nDica: Tente novamente ou use uma foto mais clara e bem iluminada.`);
    } finally {
        if (pedido === pedidoAtual) personagem.classList.remove("gerando");
    }
}

function mensagemDeErro(erro) {
    if (!erro) return "erro desconhecido";
    if (typeof erro === "string") return erro;
    return erro.error?.message || erro.message || JSON.stringify(erro);
}

// ---------- Texto "Loading..." ----------
let intervaloLoading = null;

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
}

function pararLoading() {
    clearInterval(intervaloLoading);
    intervaloLoading = null;
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
