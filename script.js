/* ============================================================
   Aviral Garg — Portfolio interactions
   Vanilla JS. No dependencies.
   ============================================================ */

(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NAV_OFFSET = 84;

  function scrollToEl(el) {
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
    window.scrollTo({ top: Math.max(top, 0), behavior: prefersReducedMotion ? "auto" : "smooth" });
  }

  var toastEl = document.getElementById("toast");
  var toastTimer = null;
  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 1900);
  }

  /* ---------- Status ticker ---------- */
  (function ticker() {
    var track = document.getElementById("tickerTrack");
    if (!track) return;
    var originals = Array.prototype.slice.call(track.children);
    originals.forEach(function (node) {
      var clone = node.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      track.appendChild(clone);
    });
  })();

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Missing-asset fallback ----------
     Keeps the layout intact (and readable) if an image fails to load. */
  (function imageFallback() {
    document.querySelectorAll("img").forEach(function (img) {
      img.addEventListener("error", function () {
        img.classList.add("img-missing");
        if (!img.dataset.fallbackApplied) {
          img.dataset.fallbackApplied = "1";
          img.setAttribute("aria-hidden", "true");
        }
      });
    });
  })();

  /* ============================================================
     Synapse field — the hero signature.
     A sparse constellation of drifting nodes. Nearby nodes are
     linked by faint edges. Periodically a node "fires": a bright
     pulse travels along its edges to neighbours, which glow and
     may fire onward — activations propagating through a network.
     ============================================================ */
  (function synapseField() {
    var canvas = document.getElementById("synapse");
    var hero = document.getElementById("hero");
    if (!canvas || !hero) return;

    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;
    var nodes = [];
    var pulses = [];
    var mouse = { x: -9999, y: -9999 };
    var running = false;
    var rafId = null;
    var lastFire = 0;

    var LINK_DIST = 150;        // px — max distance for an edge
    var MOUSE_RADIUS = 190;     // px — mouse attraction range
    var FIRE_EVERY = [900, 1700]; // ms — random interval between spontaneous firings
    var CHAIN_PROB = 0.45;      // chance a pulse propagates another hop
    var MAX_DEPTH = 3;          // max chain length
    var MAX_PULSES = 14;        // safety cap

    function resize() {
      var rect = hero.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedNodes();
    }

    function seedNodes() {
      var target = Math.max(26, Math.min(78, Math.round((W * H) / 22000)));
      nodes = [];
      for (var i = 0; i < target; i++) {
        nodes.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          r: 1.1 + Math.random() * 1.5,
          glow: 0 // 0..1, decays after firing
        });
      }
    }

    function neighboursOf(i) {
      var out = [];
      var a = nodes[i];
      for (var j = 0; j < nodes.length; j++) {
        if (j === i) continue;
        var b = nodes[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy < LINK_DIST * LINK_DIST) out.push(j);
      }
      return out;
    }

    function fire(i, depth) {
      if (pulses.length >= MAX_PULSES) return;
      nodes[i].glow = 1;
      var ns = neighboursOf(i);
      if (!ns.length) return;
      // send a pulse down 1–2 random edges
      var count = Math.min(ns.length, 1 + (Math.random() < 0.4 ? 1 : 0));
      for (var k = 0; k < count; k++) {
        var j = ns[Math.floor(Math.random() * ns.length)];
        pulses.push({ from: i, to: j, t: 0, depth: depth });
      }
    }

    function step(now) {
      ctx.clearRect(0, 0, W, H);

      // spontaneous firing
      if (now - lastFire > FIRE_EVERY[0] + Math.random() * (FIRE_EVERY[1] - FIRE_EVERY[0])) {
        fire(Math.floor(Math.random() * nodes.length), 0);
        lastFire = now;
      }

      // move nodes
      var i, n;
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        // gentle mouse attraction
        var mdx = mouse.x - n.x, mdy = mouse.y - n.y;
        var md2 = mdx * mdx + mdy * mdy;
        if (md2 < MOUSE_RADIUS * MOUSE_RADIUS && md2 > 1) {
          var md = Math.sqrt(md2);
          n.vx += (mdx / md) * 0.012;
          n.vy += (mdy / md) * 0.012;
        }
        // damping + drift
        n.vx *= 0.985; n.vy *= 0.985;
        n.x += n.vx; n.y += n.vy;
        // soft wrap
        if (n.x < -10) n.x = W + 10; if (n.x > W + 10) n.x = -10;
        if (n.y < -10) n.y = H + 10; if (n.y > H + 10) n.y = -10;
        if (n.glow > 0) n.glow = Math.max(0, n.glow - 0.02);
      }

      // edges
      ctx.lineWidth = 1;
      for (i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var a = nodes[i], b = nodes[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            var alpha = 0.14 * (1 - Math.sqrt(d2) / LINK_DIST);
            ctx.strokeStyle = "rgba(91, 124, 250," + alpha.toFixed(3) + ")";
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // travelling pulses
      for (i = pulses.length - 1; i >= 0; i--) {
        var p = pulses[i];
        var from = nodes[p.from], to = nodes[p.to];
        p.t += 0.028;
        if (p.t >= 1) {
          // pulse arrives: bloom, maybe chain onward
          if (p.depth < MAX_DEPTH && Math.random() < CHAIN_PROB) {
            fire(p.to, p.depth + 1);
          } else {
            nodes[p.to].glow = 1;
          }
          pulses.splice(i, 1);
          continue;
        }
        var px = from.x + (to.x - from.x) * p.t;
        var py = from.y + (to.y - from.y) * p.t;
        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = "rgba(194, 65, 95, 0.92)";
        ctx.fillStyle = "rgba(240, 185, 198, 0.96)";
        ctx.beginPath();
        ctx.arc(px, py, 1.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // nodes
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        var base = 0.35 + n.glow * 0.65;
        if (n.glow > 0.02) {
          ctx.save();
          ctx.shadowBlur = 16 * n.glow;
          ctx.shadowColor = "rgba(194, 65, 95, 0.9)";
        }
        ctx.fillStyle = "rgba(240, 185, 198," + base.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + n.glow * 1.4, 0, Math.PI * 2);
        ctx.fill();
        if (n.glow > 0.02) ctx.restore();
      }

      if (running) rafId = requestAnimationFrame(step);
    }

    function drawStatic() {
      // Reduced motion: draw one calm frame, no animation.
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var a = nodes[i], b = nodes[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            var alpha = 0.12 * (1 - Math.sqrt(d2) / LINK_DIST);
            ctx.strokeStyle = "rgba(91, 124, 250," + alpha.toFixed(3) + ")";
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        ctx.fillStyle = "rgba(240, 185, 198, 0.42)";
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      }
    }

    function start() {
      if (running || prefersReducedMotion) return;
      running = true;
      rafId = requestAnimationFrame(step);
    }
    function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    }

    resize();
    window.addEventListener("resize", function () { resize(); if (prefersReducedMotion) drawStatic(); }, { passive: true });

    hero.addEventListener("mousemove", function (e) {
      var rect = hero.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });
    hero.addEventListener("mouseleave", function () { mouse.x = -9999; mouse.y = -9999; });

    if (prefersReducedMotion) {
      drawStatic();
      return;
    }

    // Only animate while the hero is on screen and the tab is visible.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) start(); else stop();
        });
      }, { threshold: 0.05 }).observe(hero);
    } else {
      start();
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else if (hero.getBoundingClientRect().bottom > 0) start();
    });
  })();

  /* ---------- Typewriter roles ---------- */
  (function typewriter() {
    var el = document.querySelector(".hero-roles-typing");
    if (!el) return;
    var roles;
    try { roles = JSON.parse(el.getAttribute("data-roles") || "[]"); } catch (e) { roles = []; }
    if (!roles.length) return;

    if (prefersReducedMotion) {
      el.textContent = roles[0];
      return;
    }

    var index = 0, charIndex = 0, deleting = false;
    function tick() {
      var current = roles[index] || "";
      if (!deleting) {
        charIndex++;
        if (charIndex >= current.length + 4) {
          deleting = true;
          setTimeout(tick, 1100);
          return;
        }
      } else {
        charIndex--;
        if (charIndex <= 0) {
          deleting = false;
          index = (index + 1) % roles.length;
        }
      }
      el.textContent = current.slice(0, Math.max(charIndex, 0));
      setTimeout(tick, deleting ? 40 : 75);
    }
    tick();
  })();

  /* ---------- Stat counters ---------- */
  (function counters() {
    var els = document.querySelectorAll("[data-count]");
    if (!els.length) return;

    function animate(el) {
      var target = parseInt(el.getAttribute("data-count"), 10) || 0;
      if (prefersReducedMotion) { el.textContent = target; return; }
      var duration = 1200;
      var startTime = null;
      function frame(now) {
        if (!startTime) startTime = now;
        var t = Math.min((now - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        el.textContent = Math.round(target * eased);
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.textContent = el.getAttribute("data-count"); });
      return;
    }
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animate(entry.target);
          seen.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    els.forEach(function (el) { seen.observe(el); });
  })();

  /* ---------- Scroll reveal ---------- */
  (function reveal() {
    var revealEls = document.querySelectorAll(".reveal");
    if (!revealEls.length) return;
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) { el.classList.add("reveal-visible"); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("reveal-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { observer.observe(el); });
  })();

  /* ---------- Courses toggle ---------- */
  (function coursesToggle() {
    var buttons = document.querySelectorAll(".pill-toggle-btn");
    var panels = document.querySelectorAll(".courses-panel");
    if (!buttons.length) return;
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var targetId = btn.getAttribute("data-target");
        buttons.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        panels.forEach(function (panel) {
          panel.classList.toggle("active", panel.id === targetId);
        });
      });
    });
  })();

  /* ============================================================
     Skills → evidence map.
     Clicking a skill chip shows exactly where that skill was used.
     ============================================================ */
  (function skillEvidence() {
    var PROJ = "project", EXP = "role", CERT = "certificate", EDU = "coursework";

    var ev = {
      // Generative AI & agents
      "LLMs": [
        [EXP, "Front End Developer — UK Dept. of Computer Science", "LLM + RAG interfaces", "#experience"],
        [PROJ, "Risk-Aware AI Portfolio Managing System", "LLM risk auditor over live news", "#projects"],
        [CERT, "Develop Generative AI Applications: Get Started", "IBM · Jul 2026", "assets/certs/01-develop-generative-ai-applications.pdf"]
      ],
      "RAG": [
        [EXP, "Front End Developer — UK Dept. of Computer Science", "LlamaIndex + FAISS retrieval pipeline", "#experience"],
        [CERT, "Build RAG Applications: Get Started", "IBM · Jul 2026", "assets/certs/03-build-rag-applications.pdf"],
        [CERT, "Advanced RAG with Vector Databases and Retrievers", "IBM · Jul 2026", "assets/certs/05-advanced-rag-vector-databases-retrievers.pdf"]
      ],
      "Agentic AI": [
        [CERT, "Fundamentals of Building AI Agents", "IBM · Jul 2026", "assets/certs/06-fundamentals-of-building-ai-agents.pdf"],
        [CERT, "Agentic AI with LangChain and LangGraph", "IBM · Jul 2026", "assets/certs/07-agentic-ai-langchain-langgraph.pdf"],
        [CERT, "Agentic AI with LangGraph, CrewAI, AutoGen and BeeAI", "IBM · Jul 2026", "assets/certs/08-agentic-ai-langgraph-crewai-autogen-beeai.pdf"]
      ],
      "LangChain": [
        [CERT, "Agentic AI with LangChain and LangGraph", "IBM · Jul 2026", "assets/certs/07-agentic-ai-langchain-langgraph.pdf"]
      ],
      "LangGraph": [
        [CERT, "Agentic AI with LangChain and LangGraph", "IBM · Jul 2026", "assets/certs/07-agentic-ai-langchain-langgraph.pdf"],
        [CERT, "Agentic AI with LangGraph, CrewAI, AutoGen and BeeAI", "IBM · Jul 2026", "assets/certs/08-agentic-ai-langgraph-crewai-autogen-beeai.pdf"]
      ],
      "CrewAI": [
        [CERT, "Agentic AI with LangGraph, CrewAI, AutoGen and BeeAI", "IBM · Jul 2026", "assets/certs/08-agentic-ai-langgraph-crewai-autogen-beeai.pdf"]
      ],
      "AutoGen": [
        [CERT, "Agentic AI with LangGraph, CrewAI, AutoGen and BeeAI", "IBM · Jul 2026", "assets/certs/08-agentic-ai-langgraph-crewai-autogen-beeai.pdf"]
      ],
      "BeeAI": [
        [CERT, "Agentic AI with LangGraph, CrewAI, AutoGen and BeeAI", "IBM · Jul 2026", "assets/certs/08-agentic-ai-langgraph-crewai-autogen-beeai.pdf"]
      ],
      "MCP": [
        [CERT, "Build AI Agents using MCP", "IBM · Jul 2026", "assets/certs/09-build-ai-agents-using-mcp.pdf"]
      ],
      "Multimodal AI": [
        [CERT, "Build Multimodal Generative AI Applications", "IBM · Jul 2026", "assets/certs/02-build-multimodal-generative-ai-applications.pdf"]
      ],
      "Prompt engineering": [
        [CERT, "Develop Generative AI Applications: Get Started", "IBM · Jul 2026", "assets/certs/01-develop-generative-ai-applications.pdf"],
        [PROJ, "Risk-Aware AI Portfolio Managing System", "LLM auditor prompting", "#projects"]
      ],
      "Tool calling": [
        [CERT, "Fundamentals of Building AI Agents", "IBM · Jul 2026", "assets/certs/06-fundamentals-of-building-ai-agents.pdf"],
        [CERT, "Build AI Agents using MCP", "IBM · Jul 2026", "assets/certs/09-build-ai-agents-using-mcp.pdf"]
      ],

      // Retrieval & vector search
      "Vector databases": [
        [EXP, "Front End Developer — UK Dept. of Computer Science", "FAISS-backed retrieval at university scale", "#experience"],
        [CERT, "Vector Databases for RAG: An Introduction", "IBM · Jul 2026", "assets/certs/04-vector-databases-for-rag.pdf"]
      ],
      "FAISS": [
        [EXP, "Front End Developer — UK Dept. of Computer Science", "FAISS vector store + LlamaIndex", "#experience"]
      ],
      "Chroma": [
        [CERT, "Vector Databases for RAG: An Introduction", "IBM · Jul 2026", "assets/certs/04-vector-databases-for-rag.pdf"]
      ],
      "LlamaIndex": [
        [EXP, "Front End Developer — UK Dept. of Computer Science", "retrieval pipeline", "#experience"]
      ],
      "Embeddings": [
        [CERT, "Vector Databases for RAG: An Introduction", "IBM · Jul 2026", "assets/certs/04-vector-databases-for-rag.pdf"],
        [PROJ, "Fake News Detection", "BERT sentence representations", "#projects"]
      ],
      "Hybrid retrieval": [
        [CERT, "Advanced RAG with Vector Databases and Retrievers", "IBM · Jul 2026", "assets/certs/05-advanced-rag-vector-databases-retrievers.pdf"]
      ],
      "Gradio": [
        [EXP, "Front End Developer — UK Dept. of Computer Science", "retrieval exploration dashboard", "#experience"]
      ],

      // Machine learning
      "PyTorch": [
        [PROJ, "Fake News Detection", "fine-tuned BERT classifier", "#projects"],
        [PROJ, "Risk-Aware AI Portfolio Managing System", "PPO agent", "#projects"]
      ],
      "Deep RL (PPO)": [
        [PROJ, "Risk-Aware AI Portfolio Managing System", "PPO portfolio manager", "#projects"],
        [PROJ, "Dynamic Portfolio Management", "PPO vs. bandit benchmark", "#projects"],
        [EDU, "Sequential Decision Making", "M.S. coursework, University of Kentucky", "#education"]
      ],
      "Contextual bandits": [
        [PROJ, "Dynamic Portfolio Management", "LinUCB allocation strategy", "#projects"]
      ],
      "Transformers": [
        [PROJ, "Fake News Detection", "BERT fine-tuning across 40K+ samples", "#projects"]
      ],
      "Hugging Face": [
        [PROJ, "Fake News Detection", "model + tokenizer pipeline", "#projects"]
      ],
      "BERT": [
        [PROJ, "Fake News Detection", "40,000+ labeled news and social samples", "#projects"]
      ],

      // Languages
      "Python": [
        [EXP, "Student Engineering Technician — University of Kentucky", "parsing, visualization, QA/QC automation", "#experience"],
        [PROJ, "Risk-Aware AI Portfolio Managing System", "full RL + LLM stack", "#projects"],
        [PROJ, "Dynamic Portfolio Management", "backtesting harness", "#projects"],
        [PROJ, "Fake News Detection", "training + evaluation", "#projects"]
      ],
      "C": [
        [PROJ, "Stateful Network File Server", "Sun RPC server, quotas, block allocation", "#projects"]
      ],
      "C++": [
        [PROJ, "Robocar", "Arduino sensor telemetry loop", "#projects"]
      ],
      "C#": [
        [EXP, "Software Engineer, R&D — Recorders & Medicare Systems", ".NET clinical device software", "#experience"]
      ],
      "JavaScript": [
        [PROJ, "Medipure", "supply-chain dApp front end", "#projects"],
        [PROJ, "This portfolio", "hand-written vanilla JS", "#hero"]
      ],
      "SQL": [
        [EXP, "Software Engineer, R&D — Recorders & Medicare Systems", "clinical data storage", "#experience"]
      ],
      "Solidity": [
        [PROJ, "Medipure", "smart contracts for drug provenance", "#projects"]
      ],
      "HTML/CSS": [
        [PROJ, "This portfolio", "hand-written, no framework", "#hero"]
      ],

      // Cloud & systems
      "Kubernetes": [
        [PROJ, "Knative Function Chain Autoscaling", "cluster-level autoscaling experiments", "#projects"]
      ],
      "Knative": [
        [PROJ, "Knative Function Chain Autoscaling", "concurrency, RPS, position-aware policies", "#projects"]
      ],
      "Serverless": [
        [PROJ, "Knative Function Chain Autoscaling", "chained functions under bursty load", "#projects"]
      ],
      "Sun RPC": [
        [PROJ, "Stateful Network File Server", "RPC interface + resource isolation", "#projects"]
      ],

      // Data & NLP
      "NumPy": [
        [PROJ, "Dynamic Portfolio Management", "returns and risk computation", "#projects"]
      ],
      "Pandas": [
        [EXP, "Student Engineering Technician — University of Kentucky", "sensor data pipelines", "#experience"],
        [PROJ, "Dynamic Portfolio Management", "market data handling", "#projects"]
      ],
      "yfinance": [
        [PROJ, "Dynamic Portfolio Management", "SPY / QQQ / TLT / GLD price history", "#projects"]
      ],
      "TF-IDF": [
        [PROJ, "Fake News Detection", "classical SVM / Naive Bayes baseline", "#projects"]
      ],

      // Web, mobile, blockchain
      "Firebase": [
        [PROJ, "Helping Hand", "auth + realtime backend", "#projects"]
      ],
      "Android Studio": [
        [PROJ, "Helping Hand", "native Android client", "#projects"]
      ],
      ".NET UI": [
        [EXP, "Software Engineer, R&D — Recorders & Medicare Systems", "EEG / ECG / X-ray interfaces", "#experience"]
      ],
      "Maps API": [
        [PROJ, "Helping Hand", "live tracking and routing", "#projects"]
      ],
      "Hyperledger Fabric": [
        [PROJ, "Medipure", "permissioned drug supply chain", "#projects"]
      ],

      // Databases
      "MongoDB": [
        [EXP, "Software Engineer, R&D — Recorders & Medicare Systems", "device data storage", "#experience"]
      ],
      "DBMS integration": [
        [EXP, "Front End Developer — UK Dept. of Computer Science", "NLP-cleaned data into DBMS", "#experience"]
      ]
    };

    var panel = document.getElementById("evidence");
    var list = document.getElementById("evidenceList");
    var label = document.getElementById("evidenceFor");
    var closeBtn = document.getElementById("evidenceClose");
    var chips = document.querySelectorAll(".chip[data-ev]");
    if (!panel || !list || !chips.length) return;

    var activeChip = null;

    chips.forEach(function (chip) {
      chip.setAttribute("role", "button");
      chip.setAttribute("tabindex", "0");
      chip.setAttribute("aria-pressed", "false");
      chip.addEventListener("click", function () { select(chip); });
      chip.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(chip); }
      });
    });

    function clear() {
      chips.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
      panel.hidden = true;
      activeChip = null;
    }

    function select(chip) {
      if (activeChip === chip) { clear(); return; }
      chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
      activeChip = chip;

      var key = chip.textContent.trim();
      var rows = ev[key] || [];
      label.textContent = key;
      list.innerHTML = "";

      if (!rows.length) {
        var empty = document.createElement("li");
        empty.innerHTML = '<p class="evidence-empty">No linked work on the site yet.</p>';
        list.appendChild(empty);
      } else {
        rows.forEach(function (row) {
          var li = document.createElement("li");
          var isFile = row[3].indexOf("#") !== 0;
          var a = document.createElement("a");
          a.href = row[3];
          if (isFile) { a.target = "_blank"; a.rel = "noreferrer"; }
          a.innerHTML =
            '<span class="ev-kind"></span><span class="ev-title"></span><span class="ev-note"></span>';
          a.querySelector(".ev-kind").textContent = row[0];
          a.querySelector(".ev-title").textContent = row[1];
          a.querySelector(".ev-note").textContent = row[2];
          if (!isFile) {
            a.addEventListener("click", function (e) {
              e.preventDefault();
              scrollToEl(document.querySelector(row[3]));
            });
          }
          li.appendChild(a);
          list.appendChild(li);
        });
      }

      panel.hidden = false;
    }

    if (closeBtn) closeBtn.addEventListener("click", clear);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) clear();
    });
  })();

  /* ============================================================
     Command palette (⌘K / Ctrl-K)
     ============================================================ */
  (function commandPalette() {
    var root = document.getElementById("cmdk");
    var input = document.getElementById("cmdkInput");
    var list = document.getElementById("cmdkList");
    var trigger = document.getElementById("navSearch");
    var hint = document.getElementById("searchHint");
    if (!root || !input || !list) return;

    var isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
    if (hint) hint.textContent = isMac ? "⌘K" : "Ctrl K";

    var ICON = {
      section: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h10M4 18h7"/></svg>',
      project: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg>',
      cert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/></svg>',
      role: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
      action: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m13 2-9 12h7l-2 8 9-12h-7z"/></svg>'
    };

    var CERT_DIR = "assets/certs/";
    var items = [
      // Sections
      { g: "Sections", i: "section", t: "About", s: "background and current focus", go: "#about" },
      { g: "Sections", i: "section", t: "Experience", s: "roles and responsibilities", go: "#experience" },
      { g: "Sections", i: "section", t: "Projects", s: "selected engineering work", go: "#projects" },
      { g: "Sections", i: "section", t: "Skills", s: "tools, with evidence", go: "#skills" },
      { g: "Sections", i: "section", t: "Certifications", s: "IBM RAG and Agentic AI track", go: "#certifications" },
      { g: "Sections", i: "section", t: "Education", s: "degrees and coursework", go: "#education" },
      { g: "Sections", i: "section", t: "Contact", s: "email, phone, socials", go: "#contact" },

      // Experience
      { g: "Experience", i: "role", t: "Student Engineering Technician", s: "University of Kentucky · 2026", go: "#experience" },
      { g: "Experience", i: "role", t: "Front End Developer", s: "UK Dept. of Computer Science · 2024–25", go: "#experience" },
      { g: "Experience", i: "role", t: "Software Engineer, R&D", s: "Recorders & Medicare Systems · 2022–23", go: "#experience" },

      // Projects
      { g: "Projects", i: "project", t: "Risk-Aware AI Portfolio Managing System", s: "PPO + LLM risk auditor", go: "#projects", open: "https://github.com/aviral07-code/RiskAware_AI_Portfolio_management_System-", tag: "repo" },
      { g: "Projects", i: "project", t: "Dynamic Portfolio Management", s: "LinUCB vs. PPO benchmark", go: "#projects", open: "https://github.com/aviral07-code/Dynamic_potfolio_management", tag: "repo" },
      { g: "Projects", i: "project", t: "Knative Function Chain Autoscaling", s: "Kubernetes serverless policies", go: "#projects", open: "https://github.com/aviral07-code/Knative-function-chain", tag: "repo" },
      { g: "Projects", i: "project", t: "Stateful Network File Server", s: "Sun RPC in C", go: "#projects", open: "https://github.com/aviral07-code/Stateful-Network-file-server", tag: "repo" },
      { g: "Projects", i: "project", t: "Fake News Detection", s: "BERT vs. SVM on 40K+ samples", go: "#projects", open: "https://github.com/aviral07-code/Fake-news-detection-on-social-media-", tag: "repo" },
      { g: "Projects", i: "project", t: "Medipure", s: "Hyperledger drug supply chain", go: "#projects" },
      { g: "Projects", i: "project", t: "Helping Hand", s: "Android + Firebase + Maps", go: "#projects" },
      { g: "Projects", i: "project", t: "Robocar", s: "Arduino autonomous robot", go: "#projects" },

      // Certificates
      { g: "Certificates", i: "cert", t: "Develop Generative AI Applications", s: "IBM · Jul 2026", open: CERT_DIR + "01-develop-generative-ai-applications.pdf", tag: "PDF" },
      { g: "Certificates", i: "cert", t: "Build Multimodal Generative AI Applications", s: "IBM · Jul 2026", open: CERT_DIR + "02-build-multimodal-generative-ai-applications.pdf", tag: "PDF" },
      { g: "Certificates", i: "cert", t: "Build RAG Applications: Get Started", s: "IBM · Jul 2026", open: CERT_DIR + "03-build-rag-applications.pdf", tag: "PDF" },
      { g: "Certificates", i: "cert", t: "Vector Databases for RAG", s: "IBM · Jul 2026", open: CERT_DIR + "04-vector-databases-for-rag.pdf", tag: "PDF" },
      { g: "Certificates", i: "cert", t: "Advanced RAG with Vector Databases and Retrievers", s: "IBM · Jul 2026", open: CERT_DIR + "05-advanced-rag-vector-databases-retrievers.pdf", tag: "PDF" },
      { g: "Certificates", i: "cert", t: "Fundamentals of Building AI Agents", s: "IBM · Jul 2026", open: CERT_DIR + "06-fundamentals-of-building-ai-agents.pdf", tag: "PDF" },
      { g: "Certificates", i: "cert", t: "Agentic AI with LangChain and LangGraph", s: "IBM · Jul 2026", open: CERT_DIR + "07-agentic-ai-langchain-langgraph.pdf", tag: "PDF" },
      { g: "Certificates", i: "cert", t: "Agentic AI with LangGraph, CrewAI, AutoGen and BeeAI", s: "IBM · Jul 2026", open: CERT_DIR + "08-agentic-ai-langgraph-crewai-autogen-beeai.pdf", tag: "PDF" },
      { g: "Certificates", i: "cert", t: "Build AI Agents using MCP", s: "IBM · Jul 2026", open: CERT_DIR + "09-build-ai-agents-using-mcp.pdf", tag: "PDF" },

      // Actions
      { g: "Actions", i: "action", t: "Copy email address", s: "aviralk.garg@gmail.com", act: "copy-email" },
      { g: "Actions", i: "action", t: "Copy phone number", s: "+1 (859) 433-9706", act: "copy-phone" },
      { g: "Actions", i: "action", t: "Download resume", s: "PDF", open: "assets/resume.pdf", tag: "PDF" },
      { g: "Actions", i: "action", t: "Print this page as a resume", s: "opens the print dialog", act: "print" },
      { g: "Actions", i: "action", t: "Open GitHub profile", s: "github.com/aviral07-code", open: "https://github.com/aviral07-code", tag: "↗" },
      { g: "Actions", i: "action", t: "Open LinkedIn profile", s: "/in/aviral-garg-011273208", open: "https://www.linkedin.com/in/aviral-garg-011273208", tag: "↗" }
    ];

    var results = [];
    var cursor = 0;

    function score(item, q) {
      if (!q) return 1;
      var hay = (item.t + " " + item.s + " " + item.g).toLowerCase();
      if (hay.indexOf(q) !== -1) return 100 - hay.indexOf(q);
      // loose subsequence match
      var hi = 0;
      for (var i = 0; i < q.length; i++) {
        hi = hay.indexOf(q[i], hi);
        if (hi === -1) return 0;
        hi++;
      }
      return 10;
    }

    function render() {
      var q = input.value.trim().toLowerCase();
      results = items
        .map(function (it) { return { it: it, sc: score(it, q) }; })
        .filter(function (r) { return r.sc > 0; })
        .sort(function (a, b) { return b.sc - a.sc; })
        .map(function (r) { return r.it; });

      if (!q) results = items.slice();
      cursor = 0;
      list.innerHTML = "";

      if (!results.length) {
        list.innerHTML = '<li class="cmdk-empty">Nothing matches “' + input.value.replace(/</g, "&lt;") + '”</li>';
        return;
      }

      var lastGroup = null;
      results.forEach(function (it, idx) {
        if (it.g !== lastGroup) {
          lastGroup = it.g;
          var h = document.createElement("li");
          h.className = "cmdk-group";
          h.textContent = it.g;
          list.appendChild(h);
        }
        var li = document.createElement("li");
        li.className = "cmdk-item";
        li.setAttribute("role", "option");
        li.dataset.idx = String(idx);
        li.innerHTML =
          '<span class="cmdk-icon">' + (ICON[it.i] || ICON.section) + "</span>" +
          '<span class="cmdk-label"><span class="cmdk-title"></span><span class="cmdk-sub"></span></span>' +
          '<span class="cmdk-tag"></span>';
        li.querySelector(".cmdk-title").textContent = it.t;
        li.querySelector(".cmdk-sub").textContent = it.s || "";
        li.querySelector(".cmdk-tag").textContent = it.tag || (it.go ? "jump" : "");
        li.addEventListener("mouseenter", function () { cursor = idx; paint(); });
        li.addEventListener("click", function () { run(it); });
        list.appendChild(li);
      });
      paint();
    }

    function paint() {
      var nodes = list.querySelectorAll(".cmdk-item");
      nodes.forEach(function (n) {
        var on = Number(n.dataset.idx) === cursor;
        n.setAttribute("aria-selected", String(on));
        if (on) {
          var top = n.offsetTop, bottom = top + n.offsetHeight;
          if (top < list.scrollTop) list.scrollTop = top - 8;
          else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + 8;
        }
      });
    }

    function copy(text, what) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast(what + " copied"); });
      } else {
        var ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); toast(what + " copied"); } catch (e) { /* no-op */ }
        document.body.removeChild(ta);
      }
    }

    function run(it) {
      close();
      if (it.act === "copy-email") return copy("aviralk.garg@gmail.com", "Email");
      if (it.act === "copy-phone") return copy("+1 (859) 433-9706", "Phone number");
      if (it.act === "print") return setTimeout(function () { window.print(); }, 180);
      if (it.open) { window.open(it.open, "_blank", "noopener"); return; }
      if (it.go) scrollToEl(document.querySelector(it.go));
    }

    function open() {
      root.hidden = false;
      input.value = "";
      render();
      setTimeout(function () { input.focus(); }, 20);
    }
    function close() {
      root.hidden = true;
      if (trigger) trigger.blur();
    }

    if (trigger) trigger.addEventListener("click", open);
    root.querySelectorAll("[data-cmdk-close]").forEach(function (el) {
      el.addEventListener("click", close);
    });
    input.addEventListener("input", render);

    document.addEventListener("keydown", function (e) {
      var mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (root.hidden) open(); else close();
        return;
      }
      if (root.hidden) {
        // "/" opens search, as long as the user isn't typing in a field
        var tag = (document.activeElement && document.activeElement.tagName) || "";
        if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") { e.preventDefault(); open(); }
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); cursor = Math.min(cursor + 1, results.length - 1); paint(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); cursor = Math.max(cursor - 1, 0); paint(); }
      else if (e.key === "Enter") { e.preventDefault(); if (results[cursor]) run(results[cursor]); }
    });

    // Expose the copy helper to the inline copy buttons
    window.__copyToClipboard = copy;
  })();

  /* ---------- Copy buttons ---------- */
  (function copyButtons() {
    document.querySelectorAll(".copy-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var value = btn.getAttribute("data-copy") || "";
        if (window.__copyToClipboard) window.__copyToClipboard(value, "Copied");
        btn.classList.add("copied");
        var original = btn.textContent;
        btn.textContent = "copied ✓";
        setTimeout(function () { btn.classList.remove("copied"); btn.textContent = original; }, 1600);
      });
    });
  })();

  /* ---------- Print resume ---------- */
  (function printResume() {
    var btn = document.getElementById("printResume");
    if (!btn) return;
    btn.addEventListener("click", function () {
      // Make sure every panel prints, not just the visible tab
      document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("reveal-visible"); });
      window.print();
    });
  })();

  /* ---------- Mobile navigation ---------- */
  (function mobileNav() {
    var toggle = document.getElementById("navToggle");
    var navLinks = document.getElementById("navLinks");
    if (!toggle || !navLinks) return;
    toggle.addEventListener("click", function () {
      var isOpen = navLinks.classList.toggle("open");
      toggle.classList.toggle("open", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("open");
        toggle.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  })();

  /* ---------- Scroll progress bar ---------- */
  (function progressBar() {
    var bar = document.getElementById("scrollProgress");
    if (!bar) return;
    window.addEventListener("scroll", function () {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (docHeight > 0 ? (scrollTop / docHeight) * 100 : 0) + "%";
    }, { passive: true });
  })();

  /* ---------- Scrollspy ---------- */
  (function scrollspy() {
    var sections = Array.prototype.slice.call(document.querySelectorAll("section[id]"));
    var anchors = document.querySelectorAll(".nav-links a[href^='#']");
    if (!sections.length || !anchors.length) return;

    var ticking = false;
    function updateActive() {
      var reference = window.scrollY + 140;
      var currentId = sections[0].id;
      sections.forEach(function (section) {
        if (section.offsetTop <= reference) currentId = section.id;
      });
      anchors.forEach(function (a) {
        a.classList.toggle("active", a.getAttribute("href") === "#" + currentId);
      });
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) {
        requestAnimationFrame(updateActive);
        ticking = true;
      }
    }, { passive: true });
    updateActive();
  })();

  /* ---------- Back to top ---------- */
  (function backToTop() {
    var btn = document.getElementById("backToTop");
    if (!btn) return;
    window.addEventListener("scroll", function () {
      btn.classList.toggle("visible", window.scrollY > 500);
    }, { passive: true });
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
    });
  })();

})();
