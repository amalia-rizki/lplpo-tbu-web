// Kerangka aplikasi: pemeriksaan sesi, menu, dan perpindahan halaman lewat #/nama-halaman.
// Setiap halaman baru cukup menambah satu fungsi render dan satu baris di DAFTAR_HALAMAN.
(function () {
  var isi = document.getElementById("isi");
  var menu = document.getElementById("menu");

  // ---------- Pembantu ----------
  function el(tag, atribut, anak) {
    var e = document.createElement(tag);
    for (var k in atribut || {}) {
      if (k === "class") e.className = atribut[k];
      else e.setAttribute(k, atribut[k]);
    }
    [].concat(anak || []).forEach(function (a) {
      e.appendChild(typeof a === "string" ? document.createTextNode(a) : a);
    });
    return e;
  }

  function judul(teks, keterangan) {
    var h1 = el("h1", { tabindex: "-1" }, teks);
    var bagian = el("div", { class: "judul-halaman" }, [h1]);
    if (keterangan) bagian.appendChild(el("p", {}, keterangan));
    return bagian;
  }

  function formatAngka(n) {
    return Number(n).toLocaleString("id-ID");
  }

  function tampilkanGalat(err, ulang) {
    var kotak = el("section", { class: "panel kotak-galat", role: "alert" }, [
      el("p", {}, err.pesan || "Terjadi kesalahan. Coba lagi.")
    ]);
    var tombol = el("button", { type: "button", class: "btn btn-garis" }, "Coba lagi");
    tombol.addEventListener("click", ulang);
    kotak.appendChild(tombol);
    return kotak;
  }

  // ---------- Halaman ----------
  function renderDashboard() {
    isi.textContent = "";
    isi.appendChild(judul("Dashboard", "Ringkasan data yang tersimpan di server."));
    var muat = el("p", { class: "status-koneksi" }, "Memuat data...");
    isi.appendChild(muat);

    Promise.all([
      LPLPO.jumlah("daftar_obat", "aktif=true"),
      LPLPO.jumlah("kategori"),
      LPLPO.jumlah("unit", "aktif=true"),
      LPLPO.jumlah("batch"),
      LPLPO.jumlah("mutasi")
    ]).then(
      function (h) {
        var data = [
          ["Obat aktif", h[0]],
          ["Kategori", h[1]],
          ["Unit aktif", h[2]],
          ["Batch", h[3]],
          ["Mutasi tercatat", h[4]]
        ];
        var grid = el("div", { class: "kartu-angka" });
        data.forEach(function (d) {
          grid.appendChild(el("div", { class: "panel" }, [
            el("div", { class: "angka" }, formatAngka(d[1])),
            el("div", { class: "nama-angka" }, d[0])
          ]));
        });
        muat.replaceWith(grid);
        isi.appendChild(el("p", { class: "status-koneksi" }, "Tersambung ke " + window.LPLPO_CONFIG.API.replace("https://", "") + "."));
      },
      function (err) {
        if (err.status === 401 || err.status === 403) return keLogin();
        muat.replaceWith(tampilkanGalat(err, renderDashboard));
      }
    );
  }

  function halamanBelumAda(h) {
    return function () {
      isi.textContent = "";
      isi.appendChild(judul(h.judul, h.info));
      isi.appendChild(el("section", { class: "panel" }, [
        el("p", { style: "margin:0" }, "Halaman ini belum dibuat.")
      ]));
    };
  }

  var DAFTAR_HALAMAN = [
    { id: "dashboard", menu: "Dashboard", judul: "Dashboard", render: renderDashboard },
    { id: "penerimaan", menu: "Penerimaan", judul: "Penerimaan obat", info: "Catat obat masuk dari gudang farmasi, dinkes, atau luar." },
    { id: "pengeluaran", menu: "Pengeluaran", judul: "Pengeluaran obat", info: "Catat obat keluar ke unit. Batch disarankan berdasarkan ED terdekat." },
    { id: "permintaan", menu: "Permintaan", judul: "Permintaan dari unit", info: "Periksa permintaan unit, lalu ubah menjadi pengeluaran." },
    { id: "stockopname", menu: "Stockopname", judul: "Stockopname", info: "Cocokkan stok fisik dengan stok sistem dan telusuri selisihnya." },
    { id: "kartu-stok", menu: "Kartu stok", judul: "Kartu stok", info: "Riwayat mutasi dan saldo berjalan per obat." },
    { id: "stok", menu: "Stok dan batch", judul: "Stok dan batch", info: "Stok per batch dengan penanda ED." },
    { id: "laporan", menu: "Laporan LPLPO", judul: "Laporan LPLPO", info: "Susun laporan bulanan dan ekspor ke Excel." },
    { id: "master", menu: "Master data", judul: "Master data", info: "Kelola obat, unit, dan kategori." }
  ];

  DAFTAR_HALAMAN.forEach(function (h) {
    if (!h.render) h.render = halamanBelumAda(h);
  });

  // ---------- Menu dan perpindahan halaman ----------
  DAFTAR_HALAMAN.forEach(function (h) {
    menu.appendChild(el("a", { href: "#/" + h.id, "data-id": h.id }, h.menu));
  });

  function halamanAktif() {
    var id = (location.hash || "").replace(/^#\//, "");
    return DAFTAR_HALAMAN.filter(function (h) { return h.id === id; })[0] || DAFTAR_HALAMAN[0];
  }

  function tampilkanHalaman() {
    var h = halamanAktif();
    [].forEach.call(menu.querySelectorAll("a"), function (a) {
      if (a.getAttribute("data-id") === h.id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    document.title = h.judul + " | LPLPO TBU";
    h.render();
    window.scrollTo(0, 0);
    var h1 = isi.querySelector("h1");
    if (h1) h1.focus();
  }

  // ---------- Sesi ----------
  function keLogin() {
    LPLPO.keluar();
    location.replace("index.html");
  }

  document.getElementById("keluar").addEventListener("click", keLogin);

  var sesi = LPLPO.sesi();
  if (!sesi) {
    keLogin();
    return;
  }
  document.getElementById("email-admin").textContent = sesi.email || "";

  // Periksa sesi ke server sebelum membuka halaman. Jika ditolak, kembali ke login.
  isi.appendChild(el("p", { class: "status-koneksi" }, "Menghubungkan ke server..."));
  LPLPO.segarkan().then(
    function () {
      var baru = LPLPO.sesi();
      document.getElementById("email-admin").textContent = (baru && baru.email) || "";
      window.addEventListener("hashchange", tampilkanHalaman);
      tampilkanHalaman();
    },
    function (err) {
      if (err.status === 401 || err.status === 403) return keLogin();
      isi.textContent = "";
      isi.appendChild(judul("LPLPO TBU"));
      isi.appendChild(tampilkanGalat(err, function () { location.reload(); }));
    }
  );
})();
