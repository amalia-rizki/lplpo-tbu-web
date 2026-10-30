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
  var NAMA_TIPE = { sumber: "Sumber", penerima: "Penerima" };
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

  // ---------- Autocomplete cari obat ----------
  // onPilih(obat) dipanggil saat user memilih satu item.
  // Mengembalikan elemen wrapper yang bisa langsung dimasukkan ke DOM.
  function buatCariObat(obatList, onPilih) {
    var bungkus = el("div", { class: "cari-obat-bungkus" });
    var inp = el("input", {
      type: "search", class: "cari-obat-inp",
      placeholder: "Cari nama obat...", autocomplete: "off",
      "aria-label": "Cari obat", "aria-autocomplete": "list"
    });
    var daftar = el("div", { class: "cari-obat-daftar", hidden: true, role: "listbox" });
    bungkus.appendChild(inp);
    bungkus.appendChild(daftar);

    var fokusIdx = -1;
    var itemEls = [];

    function tutup() {
      daftar.hidden = true;
      daftar.textContent = "";
      itemEls = [];
      fokusIdx = -1;
    }

    function buka(teks) {
      var t = teks.trim().toLowerCase();
      daftar.textContent = "";
      itemEls = [];
      fokusIdx = -1;

      if (!t) { daftar.hidden = true; return; }

      // Cari di nama_utama dan nama_alias
      var cocok = obatList.filter(function (o) {
        return (o.nama_utama || "").toLowerCase().indexOf(t) !== -1 ||
               (o.nama_alias || "").toLowerCase().indexOf(t) !== -1 ||
               (o.kode || "").toLowerCase().indexOf(t) !== -1;
      }).slice(0, 30);

      if (!cocok.length) {
        daftar.appendChild(el("div", { class: "cari-obat-kosong" }, "Tidak ditemukan."));
        daftar.hidden = false;
        return;
      }

      cocok.forEach(function (o, i) {
        var item = el("div", { class: "cari-obat-item", role: "option", "data-idx": String(i) }, o.nama_utama);
        item.addEventListener("mousedown", function (e) {
          e.preventDefault(); // jaga focus tidak pindah dari inp
          inp.value = "";
          tutup();
          onPilih(o);
        });
        daftar.appendChild(item);
        itemEls.push(item);
      });
      daftar.hidden = false;
    }

    inp.addEventListener("input", function () { buka(inp.value); });
    inp.addEventListener("focus", function () { if (inp.value) buka(inp.value); });
    inp.addEventListener("blur", function () { setTimeout(tutup, 150); });

    inp.addEventListener("keydown", function (e) {
      if (daftar.hidden) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        fokusIdx = Math.min(fokusIdx + 1, itemEls.length - 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        fokusIdx = Math.max(fokusIdx - 1, 0);
      } else if (e.key === "Enter" && fokusIdx >= 0) {
        e.preventDefault();
        var o2 = obatList.filter(function (o) {
          return (o.nama_utama || "").toLowerCase().indexOf(inp.value.trim().toLowerCase()) !== -1 ||
                 (o.nama_alias || "").toLowerCase().indexOf(inp.value.trim().toLowerCase()) !== -1 ||
                 (o.kode || "").toLowerCase().indexOf(inp.value.trim().toLowerCase()) !== -1;
        }).slice(0, 30)[fokusIdx];
        if (o2) { inp.value = ""; tutup(); onPilih(o2); }
        return;
      } else if (e.key === "Escape") {
        tutup(); return;
      }
      itemEls.forEach(function (it, i) {
        it.classList.toggle("fokus", i === fokusIdx);
      });
      if (itemEls[fokusIdx]) itemEls[fokusIdx].scrollIntoView({ block: "nearest" });
    });

    return bungkus;
  }

  // ---------- Halaman: Penerimaan ----------
  function renderPenerimaan() {
    isi.textContent = "";
    isi.appendChild(judul("Penerimaan obat", "Catat obat masuk dari sumber eksternal."));
    var area = el("div", { class: "batas-dalam" });
    isi.appendChild(area);
    area.appendChild(el("p", { class: "status-koneksi" }, "Memuat data..."));

    // Muat unit sumber (tipe = "sumber") dan daftar obat aktif paralel
    Promise.all([
      LPLPO.daftar("unit", { perPage: 100, sort: "nama", filter: 'tipe = "sumber" && aktif = true' }),
      LPLPO.daftar("daftar_obat", { perPage: 500, sort: "kode", expand: "kategori", filter: "aktif = true" })
    ]).then(function (hasil) {
      area.textContent = "";
      var unitList  = hasil[0].items;
      var obatList  = hasil[1].items;

      if (!unitList.length) {
        area.appendChild(el("section", { class: "panel" }, [
          el("p", { style: "margin:0" }, "Tidak ada unit sumber (tipe 'luar') yang aktif.")
        ]));
        return;
      }

      // State form
      var state = {
        unitId: unitList.length === 1 ? unitList[0].id : "",
        tanggal: hariIni(),
        baris: []   // { obatId, batchId (null = baru), noBatch, ed, jumlah }
      };

      // ---------- Header form: unit sumber + tanggal ----------
      var pilUnit = el("select", { class: "pnr-select", id: "pnr-unit" },
        (unitList.length > 1 ? [el("option", { value: "" }, "— Pilih sumber —")] : [])
        .concat(unitList.map(function (u) {
          return el("option", { value: u.id, selected: u.id === state.unitId ? "selected" : undefined }, u.nama);
        }))
      );
      var inpTgl = el("input", { type: "date", class: "pnr-tgl", id: "pnr-tgl", value: state.tanggal });
      pilUnit.addEventListener("change", function () { state.unitId = pilUnit.value; });
      inpTgl.addEventListener("change", function () { state.tanggal = inpTgl.value; });

      var formHeader = el("div", { class: "panel pnr-header" }, [
        el("div", { class: "baris-isian" }, [
          el("div", { class: "field" }, [
            el("label", { "for": "pnr-unit" }, "Sumber"), pilUnit
          ]),
          el("div", { class: "field" }, [
            el("label", { "for": "pnr-tgl" }, "Tanggal"), inpTgl
          ])
        ])
      ]);
      area.appendChild(formHeader);

      // ---------- Tabel item ----------
      var tabelArea = el("div", { class: "batas-dalam" });
      area.appendChild(tabelArea);

      function gambarBaris() {
        tabelArea.textContent = "";
        if (!state.baris.length) {
          tabelArea.appendChild(el("p", { class: "status-koneksi" }, "Belum ada item. Tambahkan obat di bawah."));
        } else {
          state.baris.forEach(function (b, idx) {
            tabelArea.appendChild(buatBarisItem(b, idx, obatList, gambarBaris));
          });
        }
      }

      // ---------- Tambah item ----------
      var cariObat = buatCariObat(obatList, function (o) {
        var sudahAda = state.baris.some(function (b) { return b.obatId === o.id && !b._hapus; });
        if (sudahAda) return;
        state.baris.push({ obatId: o.id, batchId: null, noBatch: "", ed: "", jumlah: "" });
        gambarBaris();
        setTimeout(function () {
          var inputs = tabelArea.querySelectorAll(".pnr-inp-jumlah");
          if (inputs.length) inputs[inputs.length - 1].focus();
        }, 50);
      });

      var panelTambah = el("div", { class: "panel pnr-tambah" }, [cariObat]);
      area.appendChild(panelTambah);

      // ---------- Tombol simpan ----------
      var pesanSimpan = el("p", { class: "pesan", hidden: true });
      var tombolSimpan = el("button", { type: "button", class: "btn btn-utama" }, "Simpan penerimaan");
      tombolSimpan.addEventListener("click", function () {
        simpanPenerimaan(state, obatList, tombolSimpan, pesanSimpan, area);
      });
      area.appendChild(el("div", { class: "bilah-simpan" }, [pesanSimpan, tombolSimpan]));

      gambarBaris();
    }, function (err) {
      tanganiGalat(err, renderPenerimaan, area);
    });
  }

  // ---------- Autocomplete cari obat ----------
  function hariIni() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function buatBarisItem(b, idx, obatList, refresh) {
    var obat = obatList.filter(function (o) { return o.id === b.obatId; })[0] || {};
    var kartu = el("div", { class: "panel pnr-baris" });

    // Nama obat + tombol hapus
    var kepala = el("div", { class: "pnr-baris-kepala" }, [
      el("strong", {}, obat.nama_utama || b.obatId),
      el("button", { type: "button", class: "btn btn-bahaya pnr-hapus", "aria-label": "Hapus " + (obat.nama_utama || "") }, "✕")
    ]);
    kepala.querySelector(".pnr-hapus").addEventListener("click", function () {
      var i = b._idx !== undefined ? b._idx : idx;
      b._hapus = true;
      refresh();
    });
    kartu.appendChild(kepala);

    // Baris batch + jumlah
    var isiKartu = el("div", { class: "pnr-isi" });

    // Pilihan batch yang sudah ada (dimuat dari server)
    var batchArea = el("div", { class: "pnr-batch-area" });
    batchArea.appendChild(el("span", { class: "pudar pnr-label" }, "Batch:"));
    var batchScroll = el("div", { class: "pnr-batch-scroll" });
    batchArea.appendChild(batchScroll);

    // Muat batch untuk obat ini
    LPLPO.daftar("batch", {
      perPage: 50,
      sort: "-expired_date,nomor_batch",
      filter: 'daftar_obat = "' + b.obatId + '"'
    }).then(function (db) {
      batchScroll.textContent = "";
      db.items.forEach(function (bt) {
        var chip = el("button", {
          type: "button",
          class: "pnr-chip" + (b.batchId === bt.id ? " aktif" : ""),
          "data-id": bt.id
        }, [
          el("span", { class: "pnr-chip-no" }, bt.nomor_batch || "—"),
          el("span", { class: "pnr-chip-ed" }, bt.expired_date ? formatED(bt.expired_date) : "tanpa ED")
        ]);
        chip.addEventListener("click", function () {
          b.batchId = bt.id; b.noBatch = bt.nomor_batch; b.ed = bt.expired_date;
          b._batchBaru = false;
          batchScroll.querySelectorAll(".pnr-chip").forEach(function (c) { c.classList.remove("aktif"); });
          chip.classList.add("aktif");
          formBatchBaru.hidden = true;
        });
        batchScroll.appendChild(chip);
      });

      // Chip "+ Batch baru"
      var chipBaru = el("button", { type: "button", class: "pnr-chip pnr-chip-baru" }, "+ Batch baru");
      chipBaru.addEventListener("click", function () {
        b.batchId = null; b._batchBaru = true;
        batchScroll.querySelectorAll(".pnr-chip").forEach(function (c) { c.classList.remove("aktif"); });
        chipBaru.classList.add("aktif");
        formBatchBaru.hidden = false;
        inpNoBatch.focus();
      });
      batchScroll.appendChild(chipBaru);
    }, function () {
      batchScroll.appendChild(el("span", { class: "pudar" }, "Gagal memuat batch."));
    });

    // Form batch baru (tersembunyi sampai diklik)
    var inpNoBatch = el("input", { type: "text", class: "pnr-inp-batch", placeholder: "No. batch", autocomplete: "off" });
    var inpED = el("input", { type: "month", class: "pnr-inp-ed" });
    inpNoBatch.addEventListener("input", function () { b.noBatch = inpNoBatch.value; });
    inpED.addEventListener("change", function () { b.ed = inpED.value ? inpED.value + "-01" : ""; });
    var formBatchBaru = el("div", { class: "pnr-form-batch-baru", hidden: true }, [
      el("div", { class: "field" }, [el("label", {}, "No. batch"), inpNoBatch]),
      el("div", { class: "field" }, [el("label", {}, "Expired"), inpED])
    ]);

    // Jumlah
    var inpJumlah = el("input", {
      type: "number", min: "1", step: "1", class: "pnr-inp-jumlah",
      placeholder: "Jumlah", inputmode: "numeric",
      value: b.jumlah || ""
    });
    inpJumlah.addEventListener("input", function () { b.jumlah = inpJumlah.value; });

    var satuan = el("span", { class: "pudar pnr-satuan" }, obat.satuan || "");

    isiKartu.appendChild(batchArea);
    isiKartu.appendChild(formBatchBaru);
    isiKartu.appendChild(el("div", { class: "pnr-jumlah-baris" }, [
      el("label", { class: "pudar pnr-label" }, "Jumlah:"), inpJumlah, satuan
    ]));
    kartu.appendChild(isiKartu);
    return kartu;
  }

  function simpanPenerimaan(state, obatList, tombol, pesan, area) {
    if (!state.unitId) {
      pesan.textContent = "Pilih sumber terlebih dahulu.";
      pesan.className = "pesan galat"; pesan.hidden = false; return;
    }
    if (!state.tanggal) {
      pesan.textContent = "Isi tanggal penerimaan.";
      pesan.className = "pesan galat"; pesan.hidden = false; return;
    }

    // Filter baris yang dihapus
    state.baris = state.baris.filter(function (b) { return !b._hapus; });

    var valid = state.baris.filter(function (b) {
      return b.jumlah && Number(b.jumlah) > 0 && (b.batchId || b._batchBaru);
    });

    if (!valid.length) {
      pesan.textContent = "Tambahkan minimal satu item dengan jumlah dan batch.";
      pesan.className = "pesan galat"; pesan.hidden = false; return;
    }

    var tidakLengkap = state.baris.filter(function (b) {
      return !b._hapus && (!b.jumlah || Number(b.jumlah) < 1 || (!b.batchId && !b._batchBaru));
    });
    if (tidakLengkap.length) {
      pesan.textContent = tidakLengkap.length + " item belum lengkap (jumlah atau batch kosong).";
      pesan.className = "pesan galat"; pesan.hidden = false; return;
    }

    tombol.disabled = true; tombol.textContent = "Menyimpan...";
    pesan.hidden = true;

    // Proses berurutan: untuk setiap baris, buat batch baru dulu kalau perlu, lalu buat mutasi
    var unitItem = null;
    // Cari jenis unit sumber untuk menentukan jenis mutasi
    LPLPO.daftar("unit", { filter: 'id = "' + state.unitId + '"', perPage: 1 }).then(function (du) {
      unitItem = du.items[0];
      var jenis = (unitItem && unitItem.tipe === "penerima") ? "keluar" : "masuk";

      // Proses satu per satu (tidak paralel, agar mudah debug)
      var antrian = valid.slice();
      var hasil = [];

      function prosesBerikutnya() {
        if (!antrian.length) {
          tampilRingkasan(area, hasil, obatList, state);
          return;
        }
        var b = antrian.shift();
        var obat = obatList.filter(function (o) { return o.id === b.obatId; })[0] || {};

        function buatMutasi(batchId) {
          return LPLPO.buat("mutasi", {
            daftar_obat: b.obatId,
            batch: batchId || undefined,
            unit: state.unitId,
            jenis: jenis,
            jumlah: Number(b.jumlah),
            tanggal: state.tanggal,
            keterangan: ""
          }).then(function () {
            hasil.push({ obat: obat, jumlah: Number(b.jumlah) });
            prosesBerikutnya();
          });
        }

        if (b._batchBaru) {
          // Buat batch baru dulu
          LPLPO.buat("batch", {
            daftar_obat: b.obatId,
            nomor_batch: b.noBatch || "",
            expired_date: b.ed || undefined,
            stok: 0
          }).then(function (bt) {
            buatMutasi(bt.id);
          }, function (err) {
            pesan.textContent = "Gagal membuat batch untuk " + (obat.nama_utama || "") + ": " + (err.pesan || "");
            pesan.className = "pesan galat"; pesan.hidden = false;
            tombol.disabled = false; tombol.textContent = "Simpan penerimaan";
          });
        } else {
          buatMutasi(b.batchId);
        }
      }
      prosesBerikutnya();
    }, function (err) {
      pesan.textContent = err.pesan || "Gagal memuat data unit.";
      pesan.className = "pesan galat"; pesan.hidden = false;
      tombol.disabled = false; tombol.textContent = "Simpan penerimaan";
    });
  }

  function tampilRingkasan(area, hasilList, obatList, state) {
    area.textContent = "";
    area.appendChild(judul("Penerimaan tersimpan", "Berikut obat yang berhasil dicatat."));

    // Urutkan berdasarkan kategori.urutan lalu obat.posisi
    hasilList.sort(function (a, b) {
      var katA = (a.obat.expand && a.obat.expand.kategori) || {};
      var katB = (b.obat.expand && b.obat.expand.kategori) || {};
      var uA = katA.urutan || "99"; var uB = katB.urutan || "99";
      if (uA !== uB) return uA.localeCompare(uB);
      return (a.obat.posisi || 0) - (b.obat.posisi || 0);
    });

    var kolom = [
      { judul: "Nama obat", utama: true, isi: function (r) { return r.obat.nama_utama || "-"; } },
      { judul: "Kategori", isi: function (r) { return lencanaKategori(r.obat.expand && r.obat.expand.kategori); } },
      { judul: "Jumlah", angka: true, isi: function (r) { return formatAngka(r.jumlah) + " " + (r.obat.satuan || ""); } }
    ];
    area.appendChild(el("div", { class: "daftar" }, [buatTabel(kolom, hasilList)]));

    var tombolBaru = el("button", { type: "button", class: "btn btn-utama" }, "Catat penerimaan baru");
    tombolBaru.addEventListener("click", renderPenerimaan);
    area.appendChild(el("div", { class: "bilah-simpan" }, [tombolBaru]));
  }

  // ---------- Halaman: Pengeluaran ----------
  function renderPengeluaran() {
    isi.textContent = "";
    isi.appendChild(judul("Pengeluaran obat", "Catat obat keluar ke unit."));
    var area = el("div", { class: "batas-dalam" });
    isi.appendChild(area);
    area.appendChild(el("p", { class: "status-koneksi" }, "Memuat data..."));

    Promise.all([
      LPLPO.daftar("unit", { perPage: 100, sort: "nama", filter: 'tipe = "penerima" && aktif = true' }),
      LPLPO.daftar("daftar_obat", { perPage: 500, sort: "kode", expand: "kategori", filter: "aktif = true" }),
      LPLPO.daftar("permintaan_unit", { perPage: 50, sort: "-created", filter: 'status = "pending"', expand: "unit" })
    ]).then(function (hasil) {
      area.textContent = "";
      var unitList = hasil[0].items;
      var obatList = hasil[1].items;
      var permintaanList = hasil[2].items;

      if (permintaanList.length) {
        var perUnit = {};
        permintaanList.forEach(function (p) {
          var uid = p.unit;
          var unitNama = (p.expand && p.expand.unit && p.expand.unit.nama) || uid;
          if (!perUnit[uid]) perUnit[uid] = { nama: unitNama, items: [] };
          perUnit[uid].items.push(p);
        });

        var notifKartu = el("div", { class: "panel" });
        notifKartu.appendChild(el("p", { style: "margin:0 0 12px; font-weight:600" },
          permintaanList.length + " permintaan belum diproses:"));

        var daftarNotif = el("div", { class: "batas-dalam" });
        Object.keys(perUnit).forEach(function (uid) {
          var grup = perUnit[uid];
          var baris = el("div", { style: "display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; padding:6px 0; border-top:1px solid var(--garis)" }, [
            el("span", {}, grup.nama + " \xb7 " + grup.items.length + " item"),
            el("button", { type: "button", class: "btn btn-garis", style: "min-height:36px; padding:0 12px; font-size:15px" }, "Isi sekarang")
          ]);
          baris.querySelector("button").addEventListener("click", function () {
            renderPengeluaranDariPermintaan(area, unitList, obatList, grup.items, uid);
          });
          daftarNotif.appendChild(baris);
        });
        notifKartu.appendChild(daftarNotif);
        area.appendChild(notifKartu);
      }

      var state = { unitId: "", tanggal: hariIni(), baris: [], permintaanIds: [] };

      var pilUnit = el("select", { class: "pnr-select", id: "pgl-unit" },
        [el("option", { value: "" }, "— Pilih unit tujuan —")]
        .concat(unitList.map(function (u) { return el("option", { value: u.id }, u.nama); }))
      );
      var inpTgl = el("input", { type: "date", class: "pnr-tgl", id: "pgl-tgl", value: state.tanggal });
      pilUnit.addEventListener("change", function () { state.unitId = pilUnit.value; });
      inpTgl.addEventListener("change", function () { state.tanggal = inpTgl.value; });

      var formHeader = el("div", { class: "panel pnr-header", id: "pgl-form-header" }, [
        el("div", { class: "baris-isian" }, [
          el("div", { class: "field" }, [el("label", { "for": "pgl-unit" }, "Unit tujuan"), pilUnit]),
          el("div", { class: "field" }, [el("label", { "for": "pgl-tgl" }, "Tanggal"), inpTgl])
        ])
      ]);
      area.appendChild(formHeader);

      var tabelArea = el("div", { class: "batas-dalam" });
      area.appendChild(tabelArea);

      function gambarBaris() {
        tabelArea.textContent = "";
        state.baris = state.baris.filter(function (b) { return !b._hapus; });
        if (!state.baris.length) {
          tabelArea.appendChild(el("p", { class: "status-koneksi" }, "Belum ada item."));
        } else {
          state.baris.forEach(function (b, idx) {
            tabelArea.appendChild(buatBarisKeluarItem(b, idx, obatList, gambarBaris));
          });
        }
      }

      var cariObatPgl = buatCariObat(obatList, function (o) {
        var sudahAda = state.baris.some(function (b) { return b.obatId === o.id && !b._hapus; });
        if (sudahAda) return;
        state.baris.push({ obatId: o.id, batchId: null, jumlah: "" });
        gambarBaris();
        setTimeout(function () {
          var inputs = tabelArea.querySelectorAll(".pnr-inp-jumlah");
          if (inputs.length) inputs[inputs.length - 1].focus();
        }, 50);
      });

      area.appendChild(el("div", { class: "panel pnr-tambah" }, [cariObatPgl]));

      var pesanSimpan = el("p", { class: "pesan", hidden: true });
      var tombolSimpan = el("button", { type: "button", class: "btn btn-utama" }, "Simpan pengeluaran");
      tombolSimpan.addEventListener("click", function () {
        simpanPengeluaran(state, obatList, tombolSimpan, pesanSimpan, area);
      });
      area.appendChild(el("div", { class: "bilah-simpan" }, [pesanSimpan, tombolSimpan]));

      gambarBaris();
    }, function (err) {
      tanganiGalat(err, renderPengeluaran, area);
    });
  }

  function renderPengeluaranDariPermintaan(area, unitList, obatList, permintaanItems, unitId) {
    var formHeader = document.getElementById("pgl-form-header");
    if (!formHeader) return;
    var toRemove = [];
    var node = formHeader;
    while (node) { toRemove.push(node); node = node.nextElementSibling; }
    toRemove.forEach(function (n) { n.remove(); });

    var state = {
      unitId: unitId,
      tanggal: hariIni(),
      baris: permintaanItems.map(function (p) {
        return { obatId: p.obat, batchId: null, jumlah: String(p.jumlah_minta || ""), permintaanId: p.id };
      }),
      permintaanIds: permintaanItems.map(function (p) { return p.id; })
    };

    var unitNama = (unitList.filter(function (u) { return u.id === unitId; })[0] || {}).nama || unitId;

    var pilUnit = el("select", { class: "pnr-select", id: "pgl-unit" },
      [el("option", { value: unitId, selected: "selected" }, unitNama)]
      .concat(unitList.filter(function (u) { return u.id !== unitId; }).map(function (u) {
        return el("option", { value: u.id }, u.nama);
      }))
    );
    var inpTgl = el("input", { type: "date", class: "pnr-tgl", id: "pgl-tgl", value: state.tanggal });
    pilUnit.addEventListener("change", function () { state.unitId = pilUnit.value; });
    inpTgl.addEventListener("change", function () { state.tanggal = inpTgl.value; });

    var formHeader2 = el("div", { class: "panel pnr-header", id: "pgl-form-header" }, [
      el("div", { class: "baris-isian" }, [
        el("div", { class: "field" }, [el("label", { "for": "pgl-unit" }, "Unit tujuan"), pilUnit]),
        el("div", { class: "field" }, [el("label", { "for": "pgl-tgl" }, "Tanggal"), inpTgl])
      ])
    ]);
    area.appendChild(formHeader2);

    var tabelArea = el("div", { class: "batas-dalam" });
    area.appendChild(tabelArea);

    function gambarBaris() {
      tabelArea.textContent = "";
      state.baris = state.baris.filter(function (b) { return !b._hapus; });
      if (!state.baris.length) {
        tabelArea.appendChild(el("p", { class: "status-koneksi" }, "Belum ada item."));
      } else {
        state.baris.forEach(function (b, idx) {
          tabelArea.appendChild(buatBarisKeluarItem(b, idx, obatList, gambarBaris));
        });
      }
    }

    var cariObatDp = buatCariObat(obatList, function (o) {
      var sudahAda = state.baris.some(function (b) { return b.obatId === o.id && !b._hapus; });
      if (sudahAda) return;
      state.baris.push({ obatId: o.id, batchId: null, jumlah: "" });
      gambarBaris();
    });

    area.appendChild(el("div", { class: "panel pnr-tambah" }, [cariObatDp]));

    var pesanSimpan = el("p", { class: "pesan", hidden: true });
    var tombolSimpan = el("button", { type: "button", class: "btn btn-utama" }, "Simpan pengeluaran");
    tombolSimpan.addEventListener("click", function () {
      simpanPengeluaran(state, obatList, tombolSimpan, pesanSimpan, area);
    });
    area.appendChild(el("div", { class: "bilah-simpan" }, [pesanSimpan, tombolSimpan]));

    gambarBaris();
  }

  function buatBarisKeluarItem(b, idx, obatList, refresh) {
    var obat = obatList.filter(function (o) { return o.id === b.obatId; })[0] || {};
    var kartu = el("div", { class: "panel pnr-baris" });

    var info = el("span", { class: "pudar", style: "font-size:14px" },
      b.permintaanId ? " (dari permintaan)" : "");
    var kepala = el("div", { class: "pnr-baris-kepala" }, [
      el("div", {}, [el("strong", {}, obat.nama_utama || b.obatId), info]),
      el("button", { type: "button", class: "btn btn-bahaya pnr-hapus", "aria-label": "Hapus" }, "✕")
    ]);
    kepala.querySelector(".pnr-hapus").addEventListener("click", function () {
      b._hapus = true; refresh();
    });
    kartu.appendChild(kepala);

    var isiKartu = el("div", { class: "pnr-isi" });

    var batchArea = el("div", { class: "pnr-batch-area" });
    batchArea.appendChild(el("span", { class: "pudar pnr-label" }, "Batch (pilih FEFO):"));
    var batchScroll = el("div", { class: "pnr-batch-scroll" });
    batchArea.appendChild(batchScroll);

    LPLPO.daftar("batch", {
      perPage: 50,
      sort: "expired_date,nomor_batch",
      filter: 'daftar_obat = "' + b.obatId + '" && stok > 0'
    }).then(function (db) {
      batchScroll.textContent = "";
      if (!db.items.length) {
        batchScroll.appendChild(el("span", { class: "pudar" }, "Tidak ada stok tersedia."));
        return;
      }
      db.items.forEach(function (bt, i) {
        var chip = el("button", {
          type: "button",
          class: "pnr-chip" + (i === 0 ? " aktif" : ""),
          "data-id": bt.id
        }, [
          el("span", { class: "pnr-chip-no" }, bt.nomor_batch || "—"),
          el("span", { class: "pnr-chip-ed" }, (bt.expired_date ? formatED(bt.expired_date) : "tanpa ED") + " \xb7 stok " + bt.stok)
        ]);
        if (i === 0) { b.batchId = bt.id; }
        chip.addEventListener("click", function () {
          b.batchId = bt.id;
          batchScroll.querySelectorAll(".pnr-chip").forEach(function (c) { c.classList.remove("aktif"); });
          chip.classList.add("aktif");
        });
        batchScroll.appendChild(chip);
      });
    }, function () {
      batchScroll.appendChild(el("span", { class: "pudar" }, "Gagal memuat batch."));
    });

    var inpJumlah = el("input", {
      type: "number", min: "1", step: "1", class: "pnr-inp-jumlah",
      placeholder: "Jumlah", inputmode: "numeric",
      value: b.jumlah || ""
    });
    inpJumlah.addEventListener("input", function () { b.jumlah = inpJumlah.value; });

    isiKartu.appendChild(batchArea);
    isiKartu.appendChild(el("div", { class: "pnr-jumlah-baris" }, [
      el("label", { class: "pudar pnr-label" }, "Jumlah:"),
      inpJumlah,
      el("span", { class: "pudar pnr-satuan" }, obat.satuan || "")
    ]));
    kartu.appendChild(isiKartu);
    return kartu;
  }

  function simpanPengeluaran(state, obatList, tombol, pesan, area) {
    if (!state.unitId) {
      pesan.textContent = "Pilih unit tujuan.";
      pesan.className = "pesan galat"; pesan.hidden = false; return;
    }
    if (!state.tanggal) {
      pesan.textContent = "Isi tanggal pengeluaran.";
      pesan.className = "pesan galat"; pesan.hidden = false; return;
    }
    state.baris = state.baris.filter(function (b) { return !b._hapus; });
    if (!state.baris.length) {
      pesan.textContent = "Tambahkan minimal satu item.";
      pesan.className = "pesan galat"; pesan.hidden = false; return;
    }
    var tidakLengkap = state.baris.filter(function (b) {
      return !b.jumlah || Number(b.jumlah) < 1 || !b.batchId;
    });
    if (tidakLengkap.length) {
      pesan.textContent = tidakLengkap.length + " item belum lengkap (jumlah atau batch belum dipilih).";
      pesan.className = "pesan galat"; pesan.hidden = false; return;
    }

    tombol.disabled = true; tombol.textContent = "Menyimpan...";
    pesan.hidden = true;

    var antrian = state.baris.slice();
    var hasilList = [];

    function prosesBerikutnya() {
      if (!antrian.length) {
        var updateList = state.baris.filter(function (b) { return b.permintaanId; });
        if (!updateList.length) {
          tampilRingkasanKeluar(area, hasilList, obatList, state);
          return;
        }
        var uAntrian = updateList.slice();
        function updateBerikutnya() {
          if (!uAntrian.length) { tampilRingkasanKeluar(area, hasilList, obatList, state); return; }
          var b = uAntrian.shift();
          LPLPO.ubah("permintaan_unit", b.permintaanId, {
            status: "selesai",
            jumlah_beri: Number(b.jumlah)
          }).then(updateBerikutnya, updateBerikutnya);
        }
        updateBerikutnya();
        return;
      }
      var b = antrian.shift();
      var obat = obatList.filter(function (o) { return o.id === b.obatId; })[0] || {};
      LPLPO.buat("mutasi", {
        daftar_obat: b.obatId,
        batch: b.batchId,
        unit: state.unitId,
        jenis: "keluar",
        jumlah: Number(b.jumlah),
        tanggal: state.tanggal,
        keterangan: ""
      }).then(function () {
        hasilList.push({ obat: obat, jumlah: Number(b.jumlah) });
        prosesBerikutnya();
      }, function (err) {
        pesan.textContent = "Gagal menyimpan " + (obat.nama_utama || "") + ": " + (err.pesan || "");
        pesan.className = "pesan galat"; pesan.hidden = false;
        tombol.disabled = false; tombol.textContent = "Simpan pengeluaran";
      });
    }
    prosesBerikutnya();
  }

  function tampilRingkasanKeluar(area, hasilList, obatList, state) {
    area.textContent = "";
    area.appendChild(judul("Pengeluaran tersimpan", "Berikut obat yang berhasil dicatat."));

    hasilList.sort(function (a, b) {
      var katA = (a.obat.expand && a.obat.expand.kategori) || {};
      var katB = (b.obat.expand && b.obat.expand.kategori) || {};
      var uA = katA.urutan || "99"; var uB = katB.urutan || "99";
      if (uA !== uB) return uA.localeCompare(uB);
      return (a.obat.posisi || 0) - (b.obat.posisi || 0);
    });

    var kolom = [
      { judul: "Nama obat", utama: true, isi: function (r) { return r.obat.nama_utama || "-"; } },
      { judul: "Kategori", isi: function (r) { return lencanaKategori(r.obat.expand && r.obat.expand.kategori); } },
      { judul: "Jumlah", angka: true, isi: function (r) { return formatAngka(r.jumlah) + " " + (r.obat.satuan || ""); } }
    ];
    area.appendChild(el("div", { class: "daftar" }, [buatTabel(kolom, hasilList)]));

    var tombolCetak = el("button", { type: "button", class: "btn btn-garis" }, "Cetak tanda terima");
    tombolCetak.addEventListener("click", function () { cetakTandaTerima(hasilList, state); });
    var tombolBaru = el("button", { type: "button", class: "btn btn-utama" }, "Catat pengeluaran baru");
    tombolBaru.addEventListener("click", renderPengeluaran);
    area.appendChild(el("div", { class: "bilah-simpan" }, [tombolCetak, tombolBaru]));
  }

  function cetakTandaTerima(hasilList, state) {
    var baris = hasilList.map(function (r, i) {
      return "<tr><td>" + (i + 1) + "</td><td>" + (r.obat.nama_utama || "-") + "</td>" +
             "<td>" + (r.obat.satuan || "") + "</td>" +
             "<td style='text-align:right'>" + formatAngka(r.jumlah) + "</td></tr>";
    }).join("");
    var tgl = new Date(state.tanggal);
    var tglFmt = tgl.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    var html = "<!doctype html><html><head><meta charset='utf-8'><title>Tanda Terima</title>" +
      "<style>body{font-family:sans-serif;font-size:13px;padding:20px;max-width:600px;margin:0 auto}" +
      "h2{margin:0 0 4px}p{margin:0 0 12px}" +
      "table{width:100%;border-collapse:collapse;margin-top:8px}" +
      "th,td{border:1px solid #ccc;padding:4px 8px;text-align:left}" +
      "th{background:#f0f0f0}" +
      ".ttd{margin-top:40px;display:flex;justify-content:space-between}" +
      ".ttd div{text-align:center;width:200px}" +
      "@media print{button{display:none}}</style></head><body>" +
      "<h2>TANDA TERIMA OBAT</h2>" +
      "<p>Puskesmas Tambang Ulang</p>" +
      "<p>Tanggal: " + tglFmt + "</p>" +
      "<table><thead><tr><th>#</th><th>Nama Obat</th><th>Satuan</th><th>Jumlah</th></tr></thead>" +
      "<tbody>" + baris + "</tbody></table>" +
      "<div class='ttd'>" +
      "<div><p style='margin-top:60px'>_______________</p><p>Diserahkan oleh</p></div>" +
      "<div><p style='margin-top:60px'>_______________</p><p>Diterima oleh</p></div>" +
      "</div>" +
      "<button onclick='window.print()' style='margin-top:20px;padding:8px 20px'>Cetak</button>" +
      "</body></html>";
    var w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }

  // ---------- Halaman: Stockopname ----------
  function renderStockopname() {
    isi.textContent = "";
    isi.appendChild(judul("Stockopname", "Cocokkan stok fisik dengan stok sistem. Isi jumlah fisik per batch, lalu simpan."));

    // Kunci localStorage per bulan agar progress tidak tercampur antar bulan
    var now = new Date();
    var kunciLS = "lplpo_so_" + now.getFullYear() + "_" + (now.getMonth() + 1);

    var area = el("div", { class: "batas-dalam" });
    isi.appendChild(area);

    // Tahap yang sedang aktif: "hitung" atau "sesuaikan"
    var tabNav = el("nav", { class: "tab", "aria-label": "Tahap stockopname" });
    var tabHitung    = el("a", { href: "#/stockopname/hitung" }, "1 · Penghitungan");
    var tabSesuaikan = el("a", { href: "#/stockopname/sesuaikan" }, "2 · Penyesuaian");
    tabNav.appendChild(tabHitung);
    tabNav.appendChild(tabSesuaikan);
    area.appendChild(tabNav);

    var kontenTab = el("div", { class: "batas-dalam" });
    area.appendChild(kontenTab);

    var sub = (location.hash || "").replace(/^#\/stockopname\/?/, "") || "hitung";
    if (sub !== "sesuaikan") sub = "hitung";

    if (sub === "hitung") {
      tabHitung.setAttribute("aria-current", "page");
      tahapHitung(kontenTab, kunciLS);
    } else {
      tabSesuaikan.setAttribute("aria-current", "page");
      tahapSesuaikan(kontenTab, kunciLS);
    }
  }

  // Format tanggal ED: "Jan 2026" atau "-"
  function formatED(tgl) {
    if (!tgl) return "-";
    var d = new Date(tgl);
    if (isNaN(d)) return tgl;
    return d.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
  }

  // Apakah ED sudah lewat?
  function edLewat(tgl) {
    if (!tgl) return false;
    var d = new Date(tgl);
    if (isNaN(d)) return false;
    var sekarang = new Date();
    // Bandingkan sampai akhir bulan ED
    return d < new Date(sekarang.getFullYear(), sekarang.getMonth(), 1);
  }

  // [PERUBAHAN 28 Okt] Muat semua halaman hasil (PocketBase membatasi perPage), lalu kembalikan { items }.
  function daftarSemua(koleksi, opsi) {
    var semua = [];
    function ambil(hal) {
      var o = {};
      for (var k in opsi) o[k] = opsi[k];
      o.page = hal;
      return LPLPO.daftar(koleksi, o).then(function (d) {
        semua = semua.concat(d.items);
        if (d.page >= d.totalPages || !d.items.length) return { items: semua };
        return ambil(hal + 1);
      });
    }
    return ambil(1);
  }

  // [PERUBAHAN 28 Okt] Hapus satu record. Pakai LPLPO.hapus jika sudah ada di file API,
  // kalau belum, pakai DELETE langsung (token diambil dari LPLPO.sesi()).
  function hapusRecord(koleksi, id) {
    if (typeof LPLPO.hapus === "function") return LPLPO.hapus(koleksi, id);
    var s = LPLPO.sesi() || {};
    return fetch(window.LPLPO_CONFIG.API + "/api/collections/" + koleksi + "/records/" + id, {
      method: "DELETE",
      headers: { Authorization: s.token || "" }
    }).then(function (r) {
      if (r.ok) return true;
      var e = new Error("Gagal menghapus");
      e.status = r.status;
      e.pesan = "Gagal menghapus (kode " + r.status + ").";
      throw e;
    });
  }

  // [PERUBAHAN 28 Okt] Pesan singkat setelah memuat ulang tab Penyesuaian.
  var soPesanTerakhir = "";

  function tahapHitung(area, kunciLS) {
    area.textContent = "";
    area.appendChild(el("p", { class: "status-koneksi" }, "Memuat data batch..."));

    // Muat progress tersimpan dari localStorage
    var progress = {};
    try { progress = JSON.parse(localStorage.getItem(kunciLS) || "{}"); } catch (e) {}

    daftarSemua("batch", {
      perPage: 200,
      sort: "nomor_batch",
      expand: "daftar_obat"
    }).then(function (d) {
      area.textContent = "";

      if (!d.items.length) {
        area.appendChild(el("section", { class: "panel" }, [
          el("p", { style: "margin:0" }, "Belum ada data batch. Seed data batch terlebih dahulu.")
        ]));
        return;
      }

      // Filter: ED belum lewat atau tidak ada ED
      var items = d.items.filter(function (b) { return !edLewat(b.expired_date); });

      if (!items.length) {
        area.appendChild(el("section", { class: "panel" }, [
          el("p", { style: "margin:0" }, "Semua batch sudah melewati tanggal kedaluwarsa.")
        ]));
        return;
      }

      // [PERUBAHAN 28 Okt] Beri tahu berapa batch ED-lewat yang tidak ditampilkan.
      var tersembunyi = d.items.length - items.length;
      if (tersembunyi > 0) {
        area.appendChild(el("p", { class: "status-koneksi" },
          tersembunyi + " batch dengan ED yang sudah lewat tidak ditampilkan; di tab Penyesuaian dianggap fisik 0."));
      }

      var inputMap = {}; // id batch → input element

      // Buat tabel
      var kepala = el("thead", {}, [el("tr", {}, [
        el("th", {}, "Nama obat"),
        el("th", {}, "No. batch"),
        el("th", {}, "ED"),
        el("th", { class: "n" }, "Stok sistem"),
        el("th", { class: "n" }, "Jumlah fisik")
      ])]);

      var badan = el("tbody");
      items.forEach(function (b, idx) {
        var obat = (b.expand && b.expand.daftar_obat) || {};
        var nilaiSimpan = progress[b.id] !== undefined ? progress[b.id] : "";

        var inp = el("input", {
          type: "number", min: "0", step: "1",
          class: "inp-fisik", "data-id": b.id,
          value: String(nilaiSimpan),
          inputmode: "numeric",
          "aria-label": "Jumlah fisik " + (obat.nama_utama || b.id)
        });
        inputMap[b.id] = inp;

        // Enter → fokus ke input berikutnya
        inp.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            var kunci = Object.keys(inputMap);
            var posisi = kunci.indexOf(b.id);
            if (posisi < kunci.length - 1) {
              inputMap[kunci[posisi + 1]].focus();
              inputMap[kunci[posisi + 1]].select();
            }
          }
          // Simpan otomatis ke localStorage saat mengetik
          if (e.key !== "Tab") {
            setTimeout(function () {
              try {
                progress[b.id] = inp.value !== "" ? Number(inp.value) : "";
                localStorage.setItem(kunciLS, JSON.stringify(progress));
              } catch (x) {}
            }, 0);
          }
        });
        inp.addEventListener("change", function () {
          try {
            progress[b.id] = inp.value !== "" ? Number(inp.value) : "";
            localStorage.setItem(kunciLS, JSON.stringify(progress));
          } catch (x) {}
        });

        // Warna baris: ED bulan ini = kuning
        var edBulanIni = false;
        if (b.expired_date) {
          var d2 = new Date(b.expired_date);
          var skrg = new Date();
          edBulanIni = d2.getFullYear() === skrg.getFullYear() && d2.getMonth() === skrg.getMonth();
        }
        var tr = el("tr", { class: edBulanIni ? "terpilih" : "" }, [
          el("td", { class: "utama", "data-label": "" }, obat.nama_utama || "-"),
          el("td", { "data-label": "No. batch" }, b.nomor_batch || "-"),
          el("td", { "data-label": "ED" }, formatED(b.expired_date)),
          el("td", { class: "n", "data-label": "Stok sistem" },
            b.stok !== undefined && b.stok !== null && b.stok !== "" ? String(b.stok) : "-"),
          el("td", { class: "n", "data-label": "Jumlah fisik" }, inp)
        ]);
        badan.appendChild(tr);
      });

      var tabel = el("table", { class: "kartu" }, [kepala, badan]);
      area.appendChild(el("div", { class: "daftar" }, [el("div", { class: "tabel-gulir" }, [tabel])]));

      // Info jumlah
      var sudahDiisi = items.filter(function (b) {
        return progress[b.id] !== undefined && progress[b.id] !== "";
      }).length;
      var infoIsi = el("p", { class: "status-koneksi" },
        sudahDiisi + " dari " + items.length + " batch sudah diisi.");
      area.appendChild(infoIsi);

      // Tombol simpan
      var pesanSimpan = el("p", { class: "pesan", hidden: true });
      var tombolSimpan = el("button", { type: "button", class: "btn btn-utama" }, "Simpan dan lihat selisih");
      tombolSimpan.addEventListener("click", function () {
        // Baca semua nilai terkini dari input
        items.forEach(function (b) {
          var v = inputMap[b.id] ? inputMap[b.id].value : "";
          progress[b.id] = v !== "" ? Number(v) : "";
        });
        try { localStorage.setItem(kunciLS, JSON.stringify(progress)); } catch (x) {}

        // Hitung berapa yang masih kosong
        var kosong = items.filter(function (b) {
          return progress[b.id] === undefined || progress[b.id] === "";
        }).length;

        if (kosong > 0) {
          pesanSimpan.textContent = kosong + " batch belum diisi. Lanjutkan atau biarkan kosong untuk yang tidak dihitung.";
          pesanSimpan.className = "pesan info";
          pesanSimpan.hidden = false;
          // Tetap izinkan lanjut dengan konfirmasi
          tombolSimpan.textContent = "Tetap lanjut ke penyesuaian";
          tombolSimpan.removeEventListener("click", arguments.callee);
          tombolSimpan.addEventListener("click", function () {
            location.hash = "#/stockopname/sesuaikan";
          });
          return;
        }
        location.hash = "#/stockopname/sesuaikan";
      });

      area.appendChild(el("div", { class: "bilah-simpan" }, [pesanSimpan, tombolSimpan]));

    }, function (err) {
      tanganiGalat(err, function () { tahapHitung(area, kunciLS); }, area);
    });
  }

  function tahapSesuaikan(area, kunciLS) {
    area.textContent = "";

    var progress = {};
    try { progress = JSON.parse(localStorage.getItem(kunciLS) || "{}"); } catch (e) {}

    var adaProgress = Object.keys(progress).length > 0;
    if (!adaProgress) {
      area.appendChild(el("section", { class: "panel" }, [
        el("p", { style: "margin:0" }, "Belum ada data penghitungan. Isi jumlah fisik di tab Penghitungan terlebih dahulu.")
      ]));
      return;
    }

    // [PERUBAHAN 28 Okt] Batch ED-lewat tidak dihitung di tab 1; stok fisiknya dianggap 0.
    function fisikOtomatis(b) {
      var f = progress[b.id];
      return (f === undefined || f === "") && edLewat(b.expired_date);
    }
    function fisikDari(b) {
      var f = progress[b.id];
      if (f !== undefined && f !== "") return Number(f);
      if (edLewat(b.expired_date)) return 0;
      return null; // belum dihitung
    }

    area.appendChild(el("p", { class: "status-koneksi" }, "Memuat data untuk penyesuaian..."));

    daftarSemua("batch", {
      perPage: 200,
      sort: "nomor_batch",
      expand: "daftar_obat"
    }).then(function (d) {
      area.textContent = "";

      if (soPesanTerakhir) {
        area.appendChild(el("p", { class: "pesan info" }, soPesanTerakhir));
        soPesanTerakhir = "";
      }

      // Hanya tampilkan yang ada selisih (fisik berbeda dari stok sistem)
      var selisih = d.items.filter(function (b) {
        var fisik = fisikDari(b);
        if (fisik === null) return false;
        var sistem = (b.stok !== undefined && b.stok !== null && b.stok !== "") ? Number(b.stok) : null;
        if (sistem === null) return fisik !== 0; // stok kosong, fisik ada → selisih
        return fisik !== sistem;
      });

      if (!selisih.length) {
        area.appendChild(el("section", { class: "panel" }, [
          el("p", { style: "margin:0" }, "Tidak ada selisih. Semua stok cocok dengan hitungan fisik. 🎉")
        ]));
        return;
      }

      area.appendChild(el("p", {}, selisih.length + " batch memiliki selisih:"));

      selisih.forEach(function (b) {
        var obat = (b.expand && b.expand.daftar_obat) || {};
        var fisik = fisikDari(b);
        var sistem = (b.stok !== undefined && b.stok !== null && b.stok !== "") ? Number(b.stok) : 0;
        var diff = fisik - sistem;

        var kartu = el("div", { class: "panel so-kartu" });

        // Kepala kartu
        var kepalaKartu = el("div", { class: "so-kepala" }, [
          el("div", { class: "so-nama" }, [
            el("strong", {}, obat.nama_utama || "-"),
            el("span", { class: "pudar" }, " · " + (b.nomor_batch || "tanpa batch") + " · ED " + formatED(b.expired_date))
          ]),
          el("div", { class: "so-selisih " + (diff > 0 ? "lebih" : "kurang") }, [
            el("span", {}, (diff > 0 ? "+" : "") + diff),
            el("span", { class: "pudar so-satuan" }, " " + (obat.satuan || ""))
          ])
        ]);
        kartu.appendChild(kepalaKartu);

        // Stok sistem vs fisik
        var ringkasan = el("div", { class: "so-ringkasan" }, [
          el("span", { class: "pudar" }, "Sistem: " + sistem + "  →  Fisik: " + fisik + (fisikOtomatis(b) ? " (ED lewat, dianggap 0)" : ""))
        ]);
        kartu.appendChild(ringkasan);

        // Area transaksi (muncul setelah klik)
        var areaTransaksi = el("div", { class: "so-transaksi", hidden: true });

        var tombolDetail = el("button", { type: "button", class: "btn btn-garis so-btn-detail" }, "Lihat transaksi batch ini");
        tombolDetail.addEventListener("click", function () {
          if (!areaTransaksi.hidden) {
            areaTransaksi.hidden = true;
            tombolDetail.textContent = "Lihat transaksi batch ini";
            return;
          }
          tombolDetail.textContent = "Memuat...";
          tombolDetail.disabled = true;

          // [PERUBAHAN 28 Okt] Semua transaksi OBAT ini (semua batch dan yang tanpa batch), terbaru di atas.
          Promise.all([
            daftarSemua("mutasi", { filter: 'daftar_obat = "' + obat.id + '"', sort: "-tanggal", expand: "unit,batch", perPage: 200 }),
            daftarSemua("batch", { filter: 'daftar_obat = "' + obat.id + '"', sort: "nomor_batch", perPage: 200 })
          ]).then(function (hasil) {
            var semuaTx = hasil[0].items;
            var batchObat = hasil[1].items;
            areaTransaksi.textContent = "";
            areaTransaksi.hidden = false;
            tombolDetail.textContent = "Sembunyikan transaksi";
            tombolDetail.disabled = false;

            function labelBatch(bt) {
              if (!bt) return "tanpa batch";
              return (bt.nomor_batch || "tanpa nomor") + (bt.expired_date ? " (ED " + formatED(bt.expired_date) + ")" : "");
            }
            function namaBatchTx(tx) {
              if (!tx.batch) return "tanpa batch";
              return labelBatch((tx.expand && tx.expand.batch) || batchObat.filter(function (x) { return x.id === tx.batch; })[0]);
            }
            function opsiBatch(termasukKosong) {
              var daftar = termasukKosong ? [el("option", { value: "" }, "— tanpa relasi batch —")] : [];
              batchObat.forEach(function (bt) {
                daftar.push(el("option", { value: bt.id }, labelBatch(bt) + " · stok " + (bt.stok !== undefined && bt.stok !== null ? bt.stok : 0)));
              });
              return daftar;
            }

            var pilTampil = el("select", { class: "so-pilih-mutasi", "aria-label": "Tampilkan transaksi" }, [
              el("option", { value: "semua" }, "Semua batch obat ini (" + semuaTx.length + " transaksi)"),
              el("option", { value: "ini" }, "Batch ini saja")
            ]);
            var wadahDaftar = el("div", {});
            var wadahEdit = el("div", {});
            areaTransaksi.appendChild(pilTampil);
            areaTransaksi.appendChild(wadahDaftar);
            areaTransaksi.appendChild(wadahEdit);

            function gambar() {
              var tampil = pilTampil.value === "ini"
                ? semuaTx.filter(function (tx) { return tx.batch === b.id; })
                : semuaTx;
              wadahDaftar.textContent = "";
              wadahEdit.textContent = "";

              if (!tampil.length) {
                wadahDaftar.appendChild(el("p", { class: "pudar", style: "margin:0 0 8px" }, "Tidak ada transaksi."));
              } else {
                wadahDaftar.appendChild(el("div", { class: "so-tx-daftar" }, tampil.map(function (tx) {
                  var unitNama = (tx.expand && tx.expand.unit && tx.expand.unit.nama) || tx.unit || "-";
                  return el("div", { class: "so-tx-baris", style: tx.batch === b.id ? "font-weight:600" : "" }, [
                    el("span", { class: "pudar" }, tx.tanggal ? tx.tanggal.slice(0, 10) : "-"),
                    el("span", {}, (tx.jenis === "masuk" ? "Masuk dari " : "Keluar ke ") + unitNama + " · batch " + namaBatchTx(tx)),
                    el("span", { class: tx.jenis === "masuk" ? "so-plus" : "so-minus" },
                      (tx.jenis === "masuk" ? "+" : "-") + tx.jumlah)
                  ]);
                })));
                wadahDaftar.appendChild(el("p", { class: "pudar", style: "margin:4px 0 8px" }, "Tebal = batch yang sedang dibuka."));
              }

              if (!tampil.length) return;

              // Form edit mutasi: ubah jumlah, tanggal, dan batch, atau hapus.
              var pilMutasi = el("select", { class: "so-pilih-mutasi" },
                [el("option", { value: "" }, "— Pilih mutasi untuk diedit —")]
                .concat(tampil.map(function (tx) {
                  var unitNama = (tx.expand && tx.expand.unit && tx.expand.unit.nama) || "-";
                  return el("option", { value: tx.id },
                    (tx.tanggal ? tx.tanggal.slice(0, 10) : "") + " · " +
                    (tx.jenis === "masuk" ? "Masuk" : "Keluar") + " " + tx.jumlah + " · " + unitNama + " · " + namaBatchTx(tx));
                }))
              );
              var inpEditJumlah = el("input", { type: "number", min: "1", step: "1", class: "so-inp-edit", placeholder: "Jumlah baru", inputmode: "numeric", "aria-label": "Jumlah baru" });
              var inpEditTanggal = el("input", { type: "date", class: "so-inp-edit", "aria-label": "Tanggal mutasi" });
              var pilEditBatch = el("select", { class: "so-pilih-mutasi", "aria-label": "Batch mutasi" }, opsiBatch(true));
              var tombolEdit = el("button", { type: "button", class: "btn btn-garis", disabled: true }, "Simpan perubahan");
              var tombolHapus = el("button", { type: "button", class: "btn btn-garis", disabled: true }, "Hapus mutasi");
              var pesanEdit = el("p", { class: "pesan", hidden: true });

              pilMutasi.addEventListener("change", function () {
                var ada = !!pilMutasi.value;
                tombolEdit.disabled = !ada;
                tombolHapus.disabled = !ada;
                if (ada) {
                  var txDipilih = tampil.filter(function (t) { return t.id === pilMutasi.value; })[0];
                  if (txDipilih) {
                    inpEditJumlah.value = txDipilih.jumlah;
                    inpEditTanggal.value = txDipilih.tanggal ? txDipilih.tanggal.slice(0, 10) : "";
                    pilEditBatch.value = txDipilih.batch || "";
                  }
                }
              });

              function galatEdit(err, tombol, teksTombol) {
                pesanEdit.textContent = (err && (err.pesan || err.message)) || "Gagal menyimpan.";
                pesanEdit.className = "pesan galat"; pesanEdit.hidden = false;
                tombol.disabled = false; tombol.textContent = teksTombol;
              }

              tombolEdit.addEventListener("click", function () {
                var idTx = pilMutasi.value;
                var jumlahBaru = Number(inpEditJumlah.value);
                var tanggalBaru = inpEditTanggal.value;
                if (!idTx || !jumlahBaru || jumlahBaru < 1 || !tanggalBaru) {
                  pesanEdit.textContent = "Pilih mutasi, isi jumlah baru, dan isi tanggal.";
                  pesanEdit.className = "pesan galat"; pesanEdit.hidden = false; return;
                }
                tombolEdit.disabled = true; tombolEdit.textContent = "Menyimpan...";
                LPLPO.ubah("mutasi", idTx, { jumlah: jumlahBaru, tanggal: tanggalBaru, batch: pilEditBatch.value }).then(function () {
                  soPesanTerakhir = "Mutasi diperbarui.";
                  tahapSesuaikan(area, kunciLS);
                }, function (err) { galatEdit(err, tombolEdit, "Simpan perubahan"); });
              });

              tombolHapus.addEventListener("click", function () {
                var idTx = pilMutasi.value;
                if (!idTx) return;
                var teksPilihan = pilMutasi.options[pilMutasi.selectedIndex].textContent;
                if (!window.confirm("Hapus mutasi ini?\n" + teksPilihan + "\n\nTidak bisa dibatalkan.")) return;
                tombolHapus.disabled = true; tombolHapus.textContent = "Menghapus...";
                hapusRecord("mutasi", idTx).then(function () {
                  soPesanTerakhir = "Mutasi dihapus.";
                  tahapSesuaikan(area, kunciLS);
                }, function (err) { galatEdit(err, tombolHapus, "Hapus mutasi"); });
              });

              wadahEdit.appendChild(el("div", { class: "so-form-edit" }, [
                el("p", { class: "pudar", style: "margin:0 0 8px" }, "Edit, pindahkan batch, atau hapus mutasi:"),
                pilMutasi, inpEditJumlah, inpEditTanggal, pilEditBatch, tombolEdit, tombolHapus, pesanEdit
              ]));
            }

            pilTampil.addEventListener("change", gambar);
            gambar();

            // Form tambah mutasi baru (masuk atau keluar sesuai tipe unit)
            muatUnitUntukSO(areaTransaksi, b, obat, batchObat, function (pesan) {
              soPesanTerakhir = pesan;
              tahapSesuaikan(area, kunciLS);
            });

          }, function (err) {
            areaTransaksi.textContent = "";
            areaTransaksi.hidden = false;
            areaTransaksi.appendChild(el("p", { class: "pesan galat" }, (err && err.pesan) || "Gagal memuat transaksi."));
            tombolDetail.textContent = "Lihat transaksi batch ini";
            tombolDetail.disabled = false;
          });
        });

        kartu.appendChild(tombolDetail);
        kartu.appendChild(areaTransaksi);
        area.appendChild(kartu);
      });

    }, function (err) {
      tanganiGalat(err, function () { tahapSesuaikan(area, kunciLS); }, area);
    });
  }

  // [PERUBAHAN 28 Okt] Tambah mutasi baru: jenis ditentukan dari tipe unit
  // (unit sumber/IFK = masuk, unit penerima = keluar), tanggal bisa dipilih.
  function muatUnitUntukSO(areaTransaksi, batch, obat, batchObat, onSelesai) {
    var bagianTambah = el("div", { class: "so-form-tambah" });
    bagianTambah.appendChild(el("p", { class: "pudar", style: "margin:0 0 8px" }, "Atau tambah mutasi baru:"));

    var pilUnit = el("select", { class: "so-pilih-mutasi" }, [el("option", { value: "" }, "Memuat unit...")]);
    var petunjuk = el("p", { class: "pudar", style: "margin:0 0 8px" }, "");
    var inpTambahJumlah = el("input", { type: "number", min: "1", step: "1", class: "so-inp-edit", placeholder: "Jumlah", inputmode: "numeric", "aria-label": "Jumlah" });
    var skrg = new Date();
    var tglHari = skrg.getFullYear() + "-" + String(skrg.getMonth() + 1).padStart(2, "0") + "-" + String(skrg.getDate()).padStart(2, "0");
    var inpTambahTanggal = el("input", { type: "date", class: "so-inp-edit", value: tglHari, "aria-label": "Tanggal mutasi" });
    var pilBatchTambah = el("select", { class: "so-pilih-mutasi", "aria-label": "Batch mutasi baru" },
      [el("option", { value: "" }, "— tanpa relasi batch —")].concat(batchObat.map(function (bt) {
        return el("option", { value: bt.id }, (bt.nomor_batch || "tanpa nomor") + (bt.expired_date ? " (ED " + formatED(bt.expired_date) + ")" : ""));
      })));
    pilBatchTambah.value = batch.id;
    var tombolTambah = el("button", { type: "button", class: "btn btn-utama", disabled: true }, "Tambah mutasi");
    var pesanTambah = el("p", { class: "pesan", hidden: true });

    bagianTambah.appendChild(pilUnit);
    bagianTambah.appendChild(petunjuk);
    bagianTambah.appendChild(inpTambahJumlah);
    bagianTambah.appendChild(inpTambahTanggal);
    bagianTambah.appendChild(pilBatchTambah);
    bagianTambah.appendChild(tombolTambah);
    bagianTambah.appendChild(pesanTambah);
    areaTransaksi.appendChild(bagianTambah);

    function jenisDipilih() {
      var opt = pilUnit.options[pilUnit.selectedIndex];
      if (!opt || !opt.value) return "";
      return opt.getAttribute("data-tipe") === "sumber" ? "masuk" : "keluar";
    }

    LPLPO.daftar("unit", { perPage: 100, sort: "nama", filter: "aktif=true" }).then(function (du) {
      pilUnit.textContent = "";
      pilUnit.appendChild(el("option", { value: "" }, "— Pilih unit asal/tujuan —"));
      du.items.forEach(function (u) {
        pilUnit.appendChild(el("option", { value: u.id, "data-tipe": u.tipe || "" }, u.nama));
      });
      pilUnit.addEventListener("change", function () {
        tombolTambah.disabled = !pilUnit.value;
        var j = jenisDipilih();
        var nama = pilUnit.options[pilUnit.selectedIndex].textContent;
        petunjuk.textContent = j === "masuk" ? "Dicatat sebagai: masuk dari " + nama
          : (j === "keluar" ? "Dicatat sebagai: keluar ke " + nama : "");
      });
    }, function () {
      pilUnit.textContent = "";
      pilUnit.appendChild(el("option", { value: "" }, "Gagal memuat unit"));
    });

    tombolTambah.addEventListener("click", function () {
      var unitId = pilUnit.value;
      var jumlah = Number(inpTambahJumlah.value);
      var tanggal = inpTambahTanggal.value || tglHari;
      var jenis = jenisDipilih();
      if (!unitId || !jenis || !jumlah || jumlah < 1) {
        pesanTambah.textContent = "Pilih unit dan isi jumlah.";
        pesanTambah.className = "pesan galat"; pesanTambah.hidden = false; return;
      }
      tombolTambah.disabled = true; tombolTambah.textContent = "Menyimpan...";
      LPLPO.buat("mutasi", {
        daftar_obat: obat.id,
        batch: pilBatchTambah.value || undefined,
        unit: unitId,
        jenis: jenis,
        jumlah: jumlah,
        tanggal: tanggal,
        keterangan: "Koreksi stockopname"
      }).then(function () {
        onSelesai("Mutasi baru ditambahkan (" + (jenis === "masuk" ? "masuk" : "keluar") + " " + jumlah + ").");
      }, function (err) {
        pesanTambah.textContent = (err && (err.pesan || err.message)) || "Gagal menyimpan.";
        pesanTambah.className = "pesan galat"; pesanTambah.hidden = false;
        tombolTambah.disabled = false; tombolTambah.textContent = "Tambah mutasi";
      });
    });
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
    { id: "penerimaan", menu: "Penerimaan", judul: "Penerimaan obat", render: renderPenerimaan },
    { id: "pengeluaran", menu: "Pengeluaran", judul: "Pengeluaran obat", render: renderPengeluaran },
    { id: "permintaan", menu: "Permintaan", judul: "Permintaan dari unit", info: "Periksa permintaan unit, lalu ubah menjadi pengeluaran." },
    { id: "stockopname", menu: "Stockopname", judul: "Stockopname", render: renderStockopname },
    { id: "kartu-stok", menu: "Kartu stok", judul: "Kartu stok", info: "Riwayat mutasi dan saldo berjalan per obat." },
    { id: "stok", menu: "Stok dan batch", judul: "Stok dan batch", info: "Stok per batch dengan penanda ED." },
    { id: "laporan", menu: "Laporan LPLPO", judul: "Laporan LPLPO", info: "Susun laporan bulanan dan ekspor ke Excel." },
    { id: "master", menu: "Master data", judul: "Master data", render: renderMaster },
    { id: "pengaturan", menu: "Pengaturan", judul: "Pengaturan", info: "Preferensi tampilan, profil, dan konfigurasi aplikasi." }
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

  // ---------- Drawer HP ----------
  var menuNav    = document.getElementById("menu-nav");
  var overlay    = document.getElementById("drawer-overlay");
  var bukaTombol = document.getElementById("buka-drawer");
  var tutupTombol = document.getElementById("tutup-drawer");

  function bukaDrawer() {
    menuNav.classList.add("terbuka");
    overlay.classList.add("aktif");
    overlay.setAttribute("aria-hidden", "false");
    bukaTombol.setAttribute("aria-expanded", "true");
    tutupTombol.focus();
    document.body.style.overflow = "hidden";
  }

  function tutupDrawer() {
    menuNav.classList.remove("terbuka");
    overlay.classList.remove("aktif");
    overlay.setAttribute("aria-hidden", "true");
    bukaTombol.setAttribute("aria-expanded", "false");
    bukaTombol.focus();
    document.body.style.overflow = "";
  }

  bukaTombol.addEventListener("click", bukaDrawer);
  tutupTombol.addEventListener("click", tutupDrawer);
  overlay.addEventListener("click", tutupDrawer);

  // Tekan Escape juga menutup drawer
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && menuNav.classList.contains("terbuka")) tutupDrawer();
  });

  // Klik item menu di HP: tutup drawer dulu, baru pindah halaman
  menu.addEventListener("click", function (e) {
    var a = e.target.closest("a");
    if (a && menuNav.classList.contains("terbuka")) tutupDrawer();
  });

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
