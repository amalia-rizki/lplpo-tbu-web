// Kerangka aplikasi: pemeriksaan sesi, menu, dan perpindahan halaman lewat #/halaman atau #/halaman/bagian.
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

  // Galat dari server: sesi habis kembali ke login, selain itu tampilkan kotak galat di "tempat".
  function tanganiGalat(err, ulang, tempat) {
    if (err.status === 401 || err.status === 403) return keLogin();
    tempat.textContent = "";
    tempat.appendChild(tampilkanGalat(err, ulang));
  }

  // Tabel kartu stok. Di HP, tiap baris otomatis menjadi kartu (lihat tema.css).
  // kolom: [{ judul, utama (kolom nama, tanpa label di HP), angka (rata kanan), isi: function(baris) }]
  function buatTabel(kolom, baris) {
    var kepala = el("thead", {}, [
      el("tr", {}, kolom.map(function (k) {
        return el("th", { class: k.angka ? "n" : "" }, k.judul);
      }))
    ]);
    var badan = el("tbody", {}, baris.map(function (b) {
      return el("tr", {}, kolom.map(function (k) {
        var kelas = (k.angka ? "n " : "") + (k.utama ? "utama" : "");
        return el("td", { class: kelas.trim(), "data-label": k.utama ? "" : k.judul }, k.isi(b));
      }));
    }));
    return el("div", { class: "tabel-gulir" }, [el("table", { class: "kartu" }, [kepala, badan])]);
  }

  // Warna label kategori: dipilih dari kode kategori, jadi satu kategori selalu berwarna sama.
  var WARNA_KATEGORI = ["antibiotik", "analgesik", "vitamin", "infus", "vaksin", "alkes", "obat-luar"];
  function lencanaKategori(k) {
    if (!k) return "-";
    var kode = String(k.kode || k.id);
    var jumlah = 0;
    for (var i = 0; i < kode.length; i++) jumlah += kode.charCodeAt(i);
    return el("span", { class: "kategori " + WARNA_KATEGORI[jumlah % WARNA_KATEGORI.length] }, k.nama || kode);
  }

  function lencanaStatus(aktif) {
    return el("span", { class: "lencana " + (aktif ? "aman" : "netral") }, aktif ? "Aktif" : "Nonaktif");
  }

  // ---------- Halaman: Dashboard ----------
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

  // ---------- Halaman: Master data (hanya baca) ----------
  var NAMA_TIPE = { gudang_utama: "Gudang utama", sub_unit: "Sub unit", luar: "Luar" };
  var NAMA_KATEGORI_UNIT = { reguler: "Reguler", non_reguler: "Non-reguler", luar: "Luar" };

  function tabMaster(aktif) {
    var nav = el("nav", { class: "tab", "aria-label": "Jenis data" });
    [["obat", "Obat"], ["unit", "Unit"], ["kategori", "Kategori"]].forEach(function (t) {
      var a = el("a", { href: "#/master/" + t[0] }, t[1]);
      if (t[0] === aktif) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    });
    return nav;
  }

  function renderMaster(sub) {
    var bagian = { obat: daftarObat, unit: daftarUnit, kategori: daftarKategori };
    if (!bagian[sub]) sub = "obat";
    isi.textContent = "";
    isi.appendChild(judul("Master data", "Obat, unit, dan kategori yang tersimpan di server. Tampilan ini hanya untuk membaca."));
    isi.appendChild(tabMaster(sub));
    var area = el("div", { class: "batas-dalam" });
    isi.appendChild(area);
    bagian[sub](area);
  }

  function daftarObat(area) {
    var s = { hal: 1, teks: "", kat: "", status: "aktif", seri: 0, timer: null };

    var cari = el("input", { type: "search", class: "cari", id: "cari-obat", placeholder: "Cari nama atau kode obat", autocomplete: "off" });
    var pilKat = el("select", { class: "pilih", id: "pilih-kategori" }, [el("option", { value: "" }, "Semua kategori")]);
    var pilStatus = el("select", { class: "pilih", id: "pilih-status" }, [
      el("option", { value: "aktif" }, "Obat aktif"),
      el("option", { value: "nonaktif" }, "Obat nonaktif"),
      el("option", { value: "" }, "Semua status")
    ]);
    var alat = el("div", { class: "alat" }, [
      el("label", { class: "sr-only", "for": "cari-obat" }, "Cari obat"), cari,
      el("label", { class: "sr-only", "for": "pilih-kategori" }, "Kategori"), pilKat,
      el("label", { class: "sr-only", "for": "pilih-status" }, "Status"), pilStatus
    ]);
    var hasil = el("div", { class: "batas-dalam", "aria-live": "polite" });
    area.appendChild(alat);
    area.appendChild(hasil);

    // Daftar kategori untuk pilihan filter. Kalau gagal, filter kategori tetap berisi "Semua".
    LPLPO.daftar("kategori", { perPage: 100, sort: "urutan" }).then(function (d) {
      d.items.forEach(function (k) {
        pilKat.appendChild(el("option", { value: k.id }, k.kode + " - " + k.nama));
      });
    }, function () {});

    function saring() {
      var f = [];
      var t = s.teks.replace(/["\\]/g, "").trim();
      if (t) {
        f.push('(nama_utama ~ "' + t + '" || kode ~ "' + t + '" || nama_alias ~ "' + t + '" || nama_lplpo ~ "' + t + '")');
      }
      if (s.kat) f.push('kategori = "' + s.kat.replace(/["\\]/g, "") + '"');
      if (s.status === "aktif") f.push("aktif = true");
      if (s.status === "nonaktif") f.push("aktif = false");
      return f.join(" && ");
    }

    function gambar(d) {
      hasil.textContent = "";
      if (!d.items.length) {
        hasil.appendChild(el("section", { class: "panel" }, [
          el("p", { style: "margin:0" }, "Tidak ada obat yang cocok. Ubah kata kunci atau filter.")
        ]));
        return;
      }
      var kolom = [
        { judul: "Nama obat", utama: true, isi: function (b) { return b.nama_utama; } },
        { judul: "Kode", isi: function (b) { return b.kode; } },
        { judul: "Kategori", isi: function (b) { return lencanaKategori(b.expand && b.expand.kategori); } },
        { judul: "Satuan", isi: function (b) { return b.satuan; } },
        { judul: "Pengelolaan", isi: function (b) { return b.pakai_batch ? "Per batch" : "Tanpa batch"; } },
        { judul: "Status", isi: function (b) { return lencanaStatus(b.aktif); } }
      ];
      hasil.appendChild(el("div", { class: "daftar" }, [buatTabel(kolom, d.items)]));

      var awal = (d.page - 1) * d.perPage + 1;
      var akhir = awal + d.items.length - 1;
      var sebelum = el("button", { type: "button", class: "btn btn-garis" }, "Sebelumnya");
      var sesudah = el("button", { type: "button", class: "btn btn-garis" }, "Berikutnya");
      if (d.page <= 1) sebelum.disabled = true;
      if (d.page >= d.totalPages) sesudah.disabled = true;
      sebelum.addEventListener("click", function () { s.hal--; muat(); window.scrollTo(0, 0); });
      sesudah.addEventListener("click", function () { s.hal++; muat(); window.scrollTo(0, 0); });
      hasil.appendChild(el("div", { class: "pager" }, [
        el("span", { class: "info" }, "Menampilkan " + formatAngka(awal) + "-" + formatAngka(akhir) + " dari " + formatAngka(d.totalItems)),
        el("div", { class: "tombol" }, [sebelum, sesudah])
      ]));
    }

    function muat() {
      var nomor = ++s.seri; // jawaban lama yang datang terlambat diabaikan
      hasil.textContent = "";
      hasil.appendChild(el("p", { class: "status-koneksi" }, "Memuat data..."));
      // Di HP tiap obat menjadi kartu tinggi, jadi halaman dibuat lebih pendek.
      var perHalaman = window.matchMedia("(max-width: 720px)").matches ? 15 : 50;
      LPLPO.daftar("daftar_obat", { page: s.hal, perPage: perHalaman, sort: "kode", expand: "kategori", filter: saring() }).then(
        function (d) { if (nomor === s.seri) gambar(d); },
        function (err) { if (nomor === s.seri) tanganiGalat(err, muat, hasil); }
      );
    }

    cari.addEventListener("input", function () {
      clearTimeout(s.timer);
      s.timer = setTimeout(function () { s.teks = cari.value; s.hal = 1; muat(); }, 300);
    });
    pilKat.addEventListener("change", function () { s.kat = pilKat.value; s.hal = 1; muat(); });
    pilStatus.addEventListener("change", function () { s.status = pilStatus.value; s.hal = 1; muat(); });
    muat();
  }

  function daftarUnit(area) {
    function muat() {
      area.textContent = "";
      area.appendChild(el("p", { class: "status-koneksi" }, "Memuat data..."));
      LPLPO.daftar("unit", { perPage: 100, sort: "nama" }).then(function (d) {
        area.textContent = "";
        var kolom = [
          { judul: "Nama unit", utama: true, isi: function (b) { return b.nama; } },
          { judul: "Kode", isi: function (b) { return b.kode; } },
          { judul: "Tipe", isi: function (b) { return NAMA_TIPE[b.tipe] || b.tipe || "-"; } },
          { judul: "Kategori", isi: function (b) { return NAMA_KATEGORI_UNIT[b.kategori_unit] || b.kategori_unit || "-"; } },
          { judul: "Status", isi: function (b) { return lencanaStatus(b.aktif); } }
        ];
        area.appendChild(el("div", { class: "daftar" }, [buatTabel(kolom, d.items)]));
        area.appendChild(el("p", { class: "status-koneksi" }, formatAngka(d.totalItems) + " unit."));
      }, function (err) { tanganiGalat(err, muat, area); });
    }
    muat();
  }

  function daftarKategori(area) {
    function muat() {
      area.textContent = "";
      area.appendChild(el("p", { class: "status-koneksi" }, "Memuat data..."));
      LPLPO.daftar("kategori", { perPage: 100, sort: "urutan" }).then(function (d) {
        area.textContent = "";
        var kolom = [
          { judul: "Nama kategori", utama: true, isi: function (b) { return lencanaKategori(b); } },
          { judul: "Kode", isi: function (b) { return b.kode; } },
          { judul: "Urutan di LPLPO", isi: function (b) { return b.urutan; } }
        ];
        area.appendChild(el("div", { class: "daftar" }, [buatTabel(kolom, d.items)]));
        area.appendChild(el("p", { class: "status-koneksi" }, formatAngka(d.totalItems) + " kategori."));
      }, function (err) { tanganiGalat(err, muat, area); });
    }
    muat();
  }

  // ---------- Halaman yang belum dibuat ----------
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
    { id: "master", menu: "Master data", judul: "Master data", render: renderMaster }
  ];

  DAFTAR_HALAMAN.forEach(function (h) {
    if (!h.render) h.render = halamanBelumAda(h);
  });

  // ---------- Menu dan perpindahan halaman ----------
  DAFTAR_HALAMAN.forEach(function (h) {
    menu.appendChild(el("a", { href: "#/" + h.id, "data-id": h.id }, h.menu));
  });

  // Alamat #/master/unit dibaca sebagai halaman "master" dengan bagian "unit".
  function halamanAktif() {
    var bagian = (location.hash || "").replace(/^#\//, "").split("/");
    var h = DAFTAR_HALAMAN.filter(function (x) { return x.id === bagian[0]; })[0] || DAFTAR_HALAMAN[0];
    return { h: h, sub: bagian[1] || "" };
  }

  function tampilkanHalaman() {
    var aktif = halamanAktif();
    var h = aktif.h;
    [].forEach.call(menu.querySelectorAll("a"), function (a) {
      if (a.getAttribute("data-id") === h.id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    document.title = h.judul + " | LPLPO TBU";
    h.render(aktif.sub);
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
