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

  function tahapHitung(area, kunciLS) {
    area.textContent = "";
    area.appendChild(el("p", { class: "status-koneksi" }, "Memuat data batch..."));

    // Muat progress tersimpan dari localStorage
    var progress = {};
    try { progress = JSON.parse(localStorage.getItem(kunciLS) || "{}"); } catch (e) {}

    LPLPO.daftar("batch", {
      perPage: 500,
      sort: "expand.daftar_obat.kode,no_batch",
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
          el("td", { "data-label": "No. batch" }, b.no_batch || "-"),
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

    area.appendChild(el("p", { class: "status-koneksi" }, "Memuat data untuk penyesuaian..."));

    LPLPO.daftar("batch", {
      perPage: 500,
      sort: "expand.daftar_obat.kode,no_batch",
      expand: "daftar_obat"
    }).then(function (d) {
      area.textContent = "";

      // Hanya tampilkan yang ada selisih (fisik berbeda dari stok sistem)
      var selisih = d.items.filter(function (b) {
        var fisik = progress[b.id];
        if (fisik === undefined || fisik === "") return false;
        var sistem = (b.stok !== undefined && b.stok !== null && b.stok !== "") ? Number(b.stok) : null;
        if (sistem === null) return fisik !== 0; // stok kosong, fisik ada → selisih
        return Number(fisik) !== sistem;
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
        var fisik = Number(progress[b.id]);
        var sistem = (b.stok !== undefined && b.stok !== null && b.stok !== "") ? Number(b.stok) : 0;
        var diff = fisik - sistem;

        var kartu = el("div", { class: "panel so-kartu" });

        // Kepala kartu
        var kepalaKartu = el("div", { class: "so-kepala" }, [
          el("div", { class: "so-nama" }, [
            el("strong", {}, obat.nama_utama || "-"),
            el("span", { class: "pudar" }, " · " + (b.no_batch || "tanpa batch") + " · ED " + formatED(b.expired_date))
          ]),
          el("div", { class: "so-selisih " + (diff > 0 ? "lebih" : "kurang") }, [
            el("span", {}, (diff > 0 ? "+" : "") + diff),
            el("span", { class: "pudar so-satuan" }, " " + (obat.satuan || ""))
          ])
        ]);
        kartu.appendChild(kepalaKartu);

        // Stok sistem vs fisik
        var ringkasan = el("div", { class: "so-ringkasan" }, [
          el("span", { class: "pudar" }, "Sistem: " + sistem + "  →  Fisik: " + fisik)
        ]);
        kartu.appendChild(ringkasan);

        // Area transaksi (muncul setelah klik)
        var areaTransaksi = el("div", { class: "so-transaksi", hidden: true });

        var tombolDetail = el("button", { type: "button", class: "btn btn-garis so-btn-detail" }, "Lihat transaksi bulan ini");
        tombolDetail.addEventListener("click", function () {
          if (!areaTransaksi.hidden) {
            areaTransaksi.hidden = true;
            tombolDetail.textContent = "Lihat transaksi bulan ini";
            return;
          }
          tombolDetail.textContent = "Memuat...";
          tombolDetail.disabled = true;

          var skrg = new Date();
          var awalBulan = skrg.getFullYear() + "-" + String(skrg.getMonth() + 1).padStart(2, "0") + "-01";
          var akhirBulan = skrg.getFullYear() + "-" + String(skrg.getMonth() + 1).padStart(2, "0") + "-31";

          LPLPO.daftar("mutasi", {
            filter: 'batch = "' + b.id + '"',
            sort: "tanggal",
            expand: "unit",
            perPage: 100
          }).then(function (dm) {
            areaTransaksi.textContent = "";
            areaTransaksi.hidden = false;
            tombolDetail.textContent = "Sembunyikan transaksi";
            tombolDetail.disabled = false;

            if (!dm.items.length) {
              areaTransaksi.appendChild(el("p", { class: "pudar", style: "margin:0 0 8px" }, "Tidak ada transaksi bulan ini untuk batch ini."));
            } else {
              var barisTx = dm.items.map(function (tx) {
                var unitNama = (tx.expand && tx.expand.unit && tx.expand.unit.nama) || tx.unit || "-";
                return el("div", { class: "so-tx-baris" }, [
                  el("span", { class: "pudar" }, tx.tanggal ? tx.tanggal.slice(0, 10) : "-"),
                  el("span", {}, (tx.jenis === "masuk" ? "Masuk dari " : "Keluar ke ") + unitNama),
                  el("span", { class: tx.jenis === "masuk" ? "so-plus" : "so-minus" },
                    (tx.jenis === "masuk" ? "+" : "-") + tx.jumlah)
                ]);
              });
              var daftarTx = el("div", { class: "so-tx-daftar" }, barisTx);
              areaTransaksi.appendChild(daftarTx);
            }

            // Form edit mutasi yang ada
            if (dm.items.length) {
              var pilMutasi = el("select", { class: "so-pilih-mutasi" },
                [el("option", { value: "" }, "— Pilih mutasi untuk diedit —")]
                .concat(dm.items.map(function (tx) {
                  var unitNama = (tx.expand && tx.expand.unit && tx.expand.unit.nama) || "-";
                  return el("option", { value: tx.id },
                    (tx.tanggal ? tx.tanggal.slice(0, 10) : "") + " · " +
                    (tx.jenis === "masuk" ? "Masuk" : "Keluar") + " " + tx.jumlah + " · " + unitNama);
                }))
              );

              var inpEditJumlah = el("input", { type: "number", min: "1", step: "1", class: "so-inp-edit", placeholder: "Jumlah baru", inputmode: "numeric" });
              var tombolEdit = el("button", { type: "button", class: "btn btn-garis", disabled: true }, "Simpan perubahan");
              var pesanEdit = el("p", { class: "pesan", hidden: true });

              pilMutasi.addEventListener("change", function () {
                tombolEdit.disabled = !pilMutasi.value;
                if (pilMutasi.value) {
                  var txDipilih = dm.items.filter(function (t) { return t.id === pilMutasi.value; })[0];
                  if (txDipilih) inpEditJumlah.value = txDipilih.jumlah;
                }
              });

              tombolEdit.addEventListener("click", function () {
                var idTx = pilMutasi.value;
                var jumlahBaru = Number(inpEditJumlah.value);
                if (!idTx || !jumlahBaru || jumlahBaru < 1) {
                  pesanEdit.textContent = "Pilih mutasi dan isi jumlah baru.";
                  pesanEdit.className = "pesan galat"; pesanEdit.hidden = false; return;
                }
                tombolEdit.disabled = true; tombolEdit.textContent = "Menyimpan...";
                LPLPO.ubah("mutasi", idTx, { jumlah: jumlahBaru }).then(function () {
                  pesanEdit.textContent = "Tersimpan.";
                  pesanEdit.className = "pesan info"; pesanEdit.hidden = false;
                  tombolEdit.textContent = "Simpan perubahan";
                  // Refresh daftar transaksi
                  areaTransaksi.hidden = true;
                  tombolDetail.textContent = "Lihat transaksi bulan ini";
                  tombolDetail.disabled = false;
                }, function (err) {
                  pesanEdit.textContent = err.pesan || "Gagal menyimpan.";
                  pesanEdit.className = "pesan galat"; pesanEdit.hidden = false;
                  tombolEdit.disabled = false; tombolEdit.textContent = "Simpan perubahan";
                });
              });

              areaTransaksi.appendChild(el("div", { class: "so-form-edit" }, [
                el("p", { class: "pudar", style: "margin:0 0 8px" }, "Edit mutasi yang ada:"),
                pilMutasi, inpEditJumlah, tombolEdit, pesanEdit
              ]));
            }

            // Form tambah pengeluaran baru
            muatUnitUntukSO(areaTransaksi, b, obat);

          }, function (err) {
            areaTransaksi.textContent = "";
            areaTransaksi.hidden = false;
            areaTransaksi.appendChild(el("p", { class: "pesan galat" }, err.pesan || "Gagal memuat transaksi."));
            tombolDetail.textContent = "Lihat transaksi bulan ini";
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

  function muatUnitUntukSO(areaTransaksi, batch, obat) {
    var bagianTambah = el("div", { class: "so-form-tambah" });
    var judul2 = el("p", { class: "pudar", style: "margin:0 0 8px" }, "Atau tambah pengeluaran baru:");
    bagianTambah.appendChild(judul2);

    var pilUnit = el("select", { class: "so-pilih-mutasi" }, [el("option", { value: "" }, "Memuat unit...")]);
    var inpTambahJumlah = el("input", { type: "number", min: "1", step: "1", class: "so-inp-edit", placeholder: "Jumlah", inputmode: "numeric" });
    var tombolTambah = el("button", { type: "button", class: "btn btn-utama", disabled: true }, "Tambah pengeluaran");
    var pesanTambah = el("p", { class: "pesan", hidden: true });

    bagianTambah.appendChild(pilUnit);
    bagianTambah.appendChild(inpTambahJumlah);
    bagianTambah.appendChild(tombolTambah);
    bagianTambah.appendChild(pesanTambah);
    areaTransaksi.appendChild(bagianTambah);

    LPLPO.daftar("unit", { perPage: 100, sort: "nama", filter: "aktif=true" }).then(function (du) {
      pilUnit.textContent = "";
      pilUnit.appendChild(el("option", { value: "" }, "— Pilih unit tujuan —"));
      du.items.forEach(function (u) {
        pilUnit.appendChild(el("option", { value: u.id }, u.nama));
      });
      pilUnit.addEventListener("change", function () {
        tombolTambah.disabled = !pilUnit.value;
      });
    }, function () {
      pilUnit.textContent = "";
      pilUnit.appendChild(el("option", { value: "" }, "Gagal memuat unit"));
    });

    tombolTambah.addEventListener("click", function () {
      var unitId = pilUnit.value;
      var jumlah = Number(inpTambahJumlah.value);
      if (!unitId || !jumlah || jumlah < 1) {
        pesanTambah.textContent = "Pilih unit dan isi jumlah.";
        pesanTambah.className = "pesan galat"; pesanTambah.hidden = false; return;
      }
      tombolTambah.disabled = true; tombolTambah.textContent = "Menyimpan...";
      var skrg = new Date();
      var tglHari = skrg.getFullYear() + "-" + String(skrg.getMonth() + 1).padStart(2, "0") + "-" + String(skrg.getDate()).padStart(2, "0");
      LPLPO.buat("mutasi", {
        daftar_obat: obat.id,
        batch: batch.id,
        unit: unitId,
        jenis: "keluar",
        jumlah: jumlah,
        tanggal: tglHari,
        keterangan: "Koreksi stockopname"
      }).then(function () {
        pesanTambah.textContent = "Pengeluaran berhasil ditambahkan.";
        pesanTambah.className = "pesan info"; pesanTambah.hidden = false;
        tombolTambah.disabled = false; tombolTambah.textContent = "Tambah pengeluaran";
        inpTambahJumlah.value = "";
      }, function (err) {
        pesanTambah.textContent = err.pesan || "Gagal menyimpan.";
        pesanTambah.className = "pesan galat"; pesanTambah.hidden = false;
        tombolTambah.disabled = false; tombolTambah.textContent = "Tambah pengeluaran";
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
    { id: "penerimaan", menu: "Penerimaan", judul: "Penerimaan obat", info: "Catat obat masuk dari gudang farmasi, dinkes, atau luar." },
    { id: "pengeluaran", menu: "Pengeluaran", judul: "Pengeluaran obat", info: "Catat obat keluar ke unit. Batch disarankan berdasarkan ED terdekat." },
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
