(() => {
  "use strict";

  const IMAGE_FOLDER = "IMG";

  const diagram = document.getElementById("diagram");
  const nodes = [...document.querySelectorAll(".node")];
  const connectors = [...document.querySelectorAll(".connector")];
  const tooltip = document.getElementById("tooltip");

  const modalBackdrop = document.getElementById("modalBackdrop");
  const componentCard = document.getElementById("componentCard");
  const cardImageFrame = document.getElementById("cardImageFrame");
  const cardImage = document.getElementById("cardImage");
  const cardTitle = document.getElementById("cardTitle");
  const cardDescription = document.getElementById("cardDescription");
  const closeCard = document.getElementById("closeCard");

  const animationButton = document.getElementById("animationButton");
  const processChips = [...document.querySelectorAll(".process-chip")];

  // Elementos "hijos" clicables que abren su propia card pero que NO deben
  // llevar la clase .node (para no heredar position:absolute y no romper
  // el layout existente): iconos de aplicaciones y niveles de la pirámide.
  const subNodes = [
    ...document.querySelectorAll(".app-node"),
    ...document.querySelectorAll(".pyramid-segment")
  ];

  const animatedComponents = {
    bus: document.getElementById("bus"),
    ram: document.getElementById("ram"),
    disk: document.getElementById("disk"),
    mmu: document.getElementById("mmu")
  };

  let selectedNode = null;
  let animationsEnabled = true;
  let automaticSequenceTimer = null;

  function getNodeId(node) {
    return node.id || node.dataset.node || "";
  }

  function connectedIds(nodeId) {
    const result = new Set([nodeId]);
    connectors.forEach((connector) => {
      const from = connector.dataset.from;
      const to = connector.dataset.to;
      if (from === nodeId) result.add(to);
      if (to === nodeId) result.add(from);
    });
    return result;
  }

  function showTooltip(event, node) {
    const title = node.dataset.title;
    if (!title) return;
    tooltip.textContent = title;
    tooltip.classList.add("is-visible");
    moveTooltip(event);
  }

  function moveTooltip(event) {
    const margin = 14;
    const width = tooltip.offsetWidth || 180;
    const height = tooltip.offsetHeight || 40;
    let x = event.clientX + margin;
    let y = event.clientY + margin;
    if (x + width > window.innerWidth - 10) {
      x = event.clientX - width - margin;
    }
    if (y + height > window.innerHeight - 10) {
      y = event.clientY - height - margin;
    }
    tooltip.style.left = `${Math.max(8, x)}px`;
    tooltip.style.top = `${Math.max(8, y)}px`;
  }

  function hideTooltip() {
    tooltip.classList.remove("is-visible");
  }

  function clearHighlights() {
    nodes.forEach((node) => {
      node.classList.remove("is-selected", "is-related", "is-dimmed");
    });
    connectors.forEach((connector) => {
      connector.classList.remove("is-active", "is-dimmed");
    });
    selectedNode = null;
  }

  function highlightConnections(node) {
    const nodeId = getNodeId(node);
    if (!nodeId) return;
    clearHighlights();
    selectedNode = node;
    const related = connectedIds(nodeId);
    nodes.forEach((item) => {
      const itemId = getNodeId(item);
      if (item === node) {
        item.classList.add("is-selected");
      } else if (related.has(itemId)) {
        item.classList.add("is-related");
      } else {
        item.classList.add("is-dimmed");
      }
    });
    connectors.forEach((connector) => {
      const isConnected =
        connector.dataset.from === nodeId || connector.dataset.to === nodeId;
      connector.classList.toggle("is-active", isConnected);
      connector.classList.toggle("is-dimmed", !isConnected);
    });
  }

  function buildImagePath(fileName) {
    return `${IMAGE_FOLDER}/${encodeURIComponent(fileName)}`;
  }

  function openCard(node) {
    const title = node.dataset.title || "Componente";
    const description =
      node.dataset.description || "Sin descripción disponible.";
    const imageFile = node.dataset.image || "";

    cardTitle.textContent = title;
    cardDescription.textContent = description;

    if (imageFile) {
      cardImageFrame.classList.remove("has-no-image");
      cardImage.src = buildImagePath(imageFile);
      cardImage.alt = title;
    } else {
      cardImageFrame.classList.add("has-no-image");
      cardImage.removeAttribute("src");
      cardImage.alt = "";
    }

    modalBackdrop.classList.add("is-open");
    closeCard.focus();
  }

  function closeCardModal() {
    modalBackdrop.classList.remove("is-open");
    cardImage.removeAttribute("src");
  }

  function selectNode(node) {
    highlightConnections(node);
    openCard(node);
  }

  function activateAnimation(componentName, active = true) {
    const component = animatedComponents[componentName];
    if (!component) return;
    component.classList.toggle("is-running", active && animationsEnabled);
  }

  function startSystemAnimation() {
    Object.keys(animatedComponents).forEach((key) => {
      activateAnimation(key, true);
    });
    connectors.forEach((connector) => {
      if (!connector.classList.contains("process-link")) {
        connector.classList.add("is-flowing");
      }
    });
  }

  function stopSystemAnimation() {
    Object.values(animatedComponents).forEach((component) => {
      component.classList.remove("is-running");
    });
    connectors.forEach((connector) => {
      connector.classList.remove("is-flowing");
    });
  }

  function updateAnimationState() {
    diagram.classList.toggle("animations-off", !animationsEnabled);
    animationButton.classList.toggle("is-active", animationsEnabled);
    animationButton.textContent = animationsEnabled
      ? "Animación Activa"
      : "Animación Pausada";
    if (animationsEnabled) {
      startSystemAnimation();
    } else {
      stopSystemAnimation();
    }
  }

  function focusProcess(processName) {
    processChips.forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.process === processName);
    });

    const routeByProcess = {
      A: ["start", "ready"],
      B: ["ready", "blocked"],
      C: ["blocked", "finished"],
      D: ["ready", "finished"]
    };
    const route = routeByProcess[processName] || [];

    nodes.forEach((node) => {
      const nodeId = getNodeId(node);
      node.classList.toggle("is-related", route.includes(nodeId));
      node.classList.toggle(
        "is-dimmed",
        Boolean(nodeId) && !route.includes(nodeId) && !node.closest("#bcp")
      );
    });

    connectors.forEach((connector) => {
      const isRoute =
        route.includes(connector.dataset.from) &&
        route.includes(connector.dataset.to);
      connector.classList.toggle("is-active", isRoute);
      connector.classList.toggle("is-dimmed", !isRoute);
    });
  }

  function runAutomaticSequence() {
    const sequence = ["cpu", "ram", "bus", "driver", "disk", "mmu"];
    let index = 0;
    clearInterval(automaticSequenceTimer);
    automaticSequenceTimer = setInterval(() => {
      const node = document.getElementById(sequence[index]);
      if (node && !selectedNode && !modalBackdrop.classList.contains("is-open")) {
        nodes.forEach((item) => item.classList.remove("is-related"));
        node.classList.add("is-related");
      }
      index = (index + 1) % sequence.length;
    }, 1100);
  }

  // ============================================================
  // 🔥 FUNCIÓN AUXILIAR: Verifica si el clic fue en el botón
  //    de Dirección Virtual para redirigir a la otra página.
  // ============================================================
  function shouldRedirectToVirtual(event) {
    return Boolean(event.target.closest("#btnIrVirtual"));
  }

  nodes.forEach((node) => {
    node.addEventListener("mouseenter", (event) => {
      showTooltip(event, node);
    });
    node.addEventListener("mousemove", moveTooltip);
    node.addEventListener("mouseleave", hideTooltip);
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      hideTooltip();

      // 🔥 Si el clic fue en el botón "DIR. VIRTUAL", redirigir
      if (shouldRedirectToVirtual(event)) {
        window.location.href = "direcVirtual.html";
        return;
      }

      selectNode(node);
    });
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();

        // 🔥 También permitimos redirigir con teclado
        if (shouldRedirectToVirtual(event)) {
          window.location.href = "direcVirtual.html";
          return;
        }

        selectNode(node);
      }
    });
  });

  subNodes.forEach((node) => {
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      hideTooltip();
      openCard(node);
    });
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        openCard(node);
      }
    });
  });

  processChips.forEach((chip) => {
    chip.addEventListener("click", (event) => {
      event.stopPropagation();
      clearHighlights();
      focusProcess(chip.dataset.process);
    });
  });

  diagram.addEventListener("click", (event) => {
    if (
      !event.target.closest(".node") &&
      !event.target.closest(".process-chip")
    ) {
      clearHighlights();
      processChips.forEach((chip) => chip.classList.remove("is-active"));
    }
  });

  closeCard.addEventListener("click", (event) => {
    event.stopPropagation();
    closeCardModal();
  });

  modalBackdrop.addEventListener("click", (event) => {
    if (event.target === modalBackdrop) {
      closeCardModal();
    }
  });

  animationButton.addEventListener("click", () => {
    animationsEnabled = !animationsEnabled;
    updateAnimationState();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (modalBackdrop.classList.contains("is-open")) {
        closeCardModal();
      } else {
        clearHighlights();
      }
    }
  });

  window.addEventListener("resize", hideTooltip);

  updateAnimationState();
  runAutomaticSequence();
})();