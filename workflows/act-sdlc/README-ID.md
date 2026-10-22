# ACT SDLC Workflows

Sebuah plugin Claude Code untuk alur kerja pengembangan natserract. Pekerjaan dimulai sebagai issue Linear, dan act-sdlc membantu Anda membawanya dari ide hingga rilis:

```
 Issue Linear ──► /plan ──► /to-spec ──► review di Linear ──► /start ──► /verify ──► rilis
                 triase     tulis        (tim menyetujui)     bangun      cek tes,
                 & pecah    RFC                               satu tugas  desain &
                                                              demi tugas  keamanan
```

Setiap issue mendapatkan satu **RFC** (dokumen rencana) di Linear. Tim Anda meninjau dan menyetujuinya di sana, dan Claude mengikutinya untuk membangun dan memeriksa pekerjaan tersebut.

## Mulai Cepat

**1. Instal** (sekali):

```bash
claude plugin marketplace add natserract/ai
claude plugin install act-sdlc@actual
```

**2. Siapkan mesin Anda** (sekali), di dalam Claude Code:

```
/act-sdlc:init      # membuat ruang kerja Anda ~/.act/
/act-sdlc:setup     # menambahkan kunci API terjemahan Anda (opsional)
```

**3. Kerjakan sebuah issue,** misalnya ACT-95:

| Langkah | Jalankan | Apa yang terjadi |
| :- | :- | :- |
| 1. Rencana (Plan) | `/act-sdlc:plan ACT-95` | Memeriksa apakah issue sudah siap, menambahkan label, dan memecahnya menjadi sub-issue jika terlalu besar |
| 2. Tulis Rencana | `/act-sdlc:to-spec ACT-95` | Menulis RFC dan mempostingnya ke issue di Linear |
| 3. Setujui | *(di Linear)* | Tim meninjau RFC, lalu memindahkan issue ke **In Progress (Sedang Berjalan)** |
| 4. Bangun (Build) | `/act-sdlc:start ACT-95` | Mengerjakan tugas selanjutnya untuk repositori saat ini, memeriksanya, dan mencentangnya di RFC. Jalankan lagi untuk tugas berikutnya |
| 5. Periksa (Verify) | `/act-sdlc:verify ACT-95` | Memeriksa tes, desain, dan keamanan, serta mencatat hasil lulus atau gagal di RFC |
| 6. Rilis | *(di Linear)* | Rilis fiturnya, lalu pindahkan issue ke **Done/Released (Selesai/Dirilis)** |

Bingung? Jalankan `/act-sdlc:status ACT-95` kapan saja. Perintah ini memberi tahu Anda di mana posisi issue dan apa yang harus dilakukan selanjutnya.

## Perintah

### Sehari-hari

| Perintah | Digunakan untuk |
| :- | :- |
| `/act-sdlc:plan <issue>` | Melakukan triase pada issue, dan memecah issue besar menjadi sub-issue yang lebih kecil |
| `/act-sdlc:to-spec <issue>` | Menulis RFC issue dan mempostingnya ke Linear |
| `/act-sdlc:start <issue>` | Membangun tugas RFC selanjutnya di repositori saat ini |
| `/act-sdlc:verify <issue>` | Memeriksa pekerjaan yang sudah selesai di repositori saat ini sebelum rilis |
| `/act-sdlc:status <issue>` | Melihat posisi issue dan langkah selanjutnya |
| `/act-sdlc:review <PR link or issue>` | Meninjau pull request (PR) milik rekan tim |

### Membaca

| Perintah | Digunakan untuk |
| :- | :- |
| `/act-sdlc:open <issue>` | Membuka RFC dalam bahasa Anda (`--en` untuk bahasa Inggris, `--linear` untuk membukanya di Linear) |
| `/act-sdlc:translate-issue <issue>` | Menerjemahkan issue Linear ke dalam bahasa Anda |

### Setup

| Perintah | Digunakan untuk |
| :- | :- |
| `/act-sdlc:init` | Membuat ruang kerja Anda `~/.act/` (sekali per mesin) |
| `/act-sdlc:setup` | Menambahkan atau memeriksa kunci API terjemahan Anda |
| `/act-sdlc:config` | Menampilkan atau mengubah pengaturan Anda |

`<issue>` adalah kunci issue seperti `ACT-95`, atau URL issue Linear.

<details>
<summary><b>Opsi untuk setiap perintah</b></summary>

| Perintah | Opsi |
| :- | :- |
| `plan` | `--no-split`: menampilkan usulan pemisahan tanpa membuat sub-issue |
| `to-spec` | `--no-publish`: menyimpan RFC di mesin Anda alih-alih mempostingnya |
| `start` | `--task 2.2`: tugas tertentu. `--group 3`: keseluruhan grup tugas. `--all`: setiap tugas yang terbuka. `--force`: memulai sebelum RFC disetujui |
| `verify` | `--deep`: ulasan keamanan yang lebih mendalam. `--base <branch>`: membandingkan dengan branch lain |
| `review` | `--deep`: ulasan keamanan yang lebih mendalam. `--no-comment`: jangan posting di PR |
| `open` | `--en`: RFC berbahasa Inggris. `--linear`: membukanya di Linear. `--print`: menampilkannya di obrolan |
| `translate-issue` | `--lang in`: bahasa lain. `--force`: menerjemahkan ulang. `--summary`: hanya menampilkan ringkasan |

</details>

## Apa yang diperiksa oleh setiap langkah

- **`/plan`:** apakah issue sudah jelas, dan apakah memiliki kriteria penerimaan (acceptance criteria)? Apakah cukup kecil untuk satu RFC? Jika terlalu besar, issue akan dipecah menjadi tiket **keputusan** (pertanyaan untuk dijawab terlebih dahulu) dan tiket **pekerjaan**, beserta urutan pengerjaannya.
- **`/to-spec`:** RFC terdiri dari empat bagian:
  1. **Proposal:** mengapa pekerjaan ini dibutuhkan.
  2. **Requirements (Persyaratan):** apa yang harus bernilai benar, sebagai skenario yang dapat diuji.
  3. **Design (Desain):** bagaimana cara kerjanya, termasuk diagram [Call Graph](docs/call-graph.md) dan **siapa yang harus ditanya** tentang setiap bagian kode.
  4. **Tasks (Tugas):** daftar periksa, setiap tugas diberi tag dengan repositorinya.
- **`/start`:** mengikuti desain RFC, menjalankan pemeriksaan untuk masing-masing tugas, dan baru mencentang tugas setelahnya.
- **`/verify`:** setiap skenario memiliki tes yang lulus, kode sesuai dengan desain, ulasan kode, dan [ulasan keamanan](docs/security-review.md) berdasarkan OWASP Top 10, yang akan diperiksa lebih mendalam untuk area sensitif seperti otentikasi, pembayaran, dan data pribadi.
- **`/review`:** pemeriksaan yang sama pada pull request, tanpa melakukan checkout. Ini dapat memposting ulasan pada PR, dan mengubah temuan yang Anda pilih menjadi issue Linear baru.

## Apa yang diubah act-sdlc, dan apa yang tidak

| Di mana | act-sdlc mungkin | act-sdlc tidak pernah |
| :- | :- | :- |
| **Linear** | Memposting RFC dan satu komentar (`/to-spec`); menambahkan label dan membuat sub-issue (`/plan`); mencentang tugas (`/start`); mencatat hasil verifikasi di RFC (`/verify`); membuat issue yang Anda pilih (`/review`) | Mengubah status, penerima tugas (assignee), judul, atau deskripsi issue, atau menghapus label |
| **GitHub** | Memposting ulasan komentar pada PR, saat Anda memilih untuk melakukannya (`/review`) | Menyetujui (Approve) atau meminta perubahan (Request changes) |
| **Kode Anda** | Mengedit file saat membangun (`/start`) dan menambahkan tes (`/verify`) | Membuat atau berpindah branch, melakukan commit, atau push. Git adalah kendali Anda |
| **Mesin Anda** | Menyimpan draf dan terjemahan di `~/.act/`, dan pengaturan di `~/.config/act-sdlc/` | Menambahkan file ke repositori aplikasi Anda |

Manusia yang memindahkan status issue, menugaskan pekerjaan, dan menyetujui PR.

## Pengaturan

Pengaturan bersifat personal. Ubah dengan `/act-sdlc:config`:

```
/act-sdlc:config show                          # melihat semua pengaturan
/act-sdlc:config set translate.language id     # menerjemahkan ke bahasa Indonesia
/act-sdlc:config set rfc.publish false         # menyimpan RFC di mesin Anda
```

| Pengaturan | Default | Fungsinya |
| :- | :- | :- |
| `translate.language` | `id` | Bahasa Anda, sebagai kode negara: `id` Indonesia, `in` Hindi, `jp` Jepang, dan [lainnya](docs/translation.md#choose-a-language) |
| `translate.provider` | `gemini` | AI mana yang menerjemahkan: `gemini`, `claude`, `openai`, atau `openrouter` |
| `translate.model` | kosong | Model tertentu. Diperlukan untuk `openai` dan `openrouter` |
| `translate.auto` | `false` | Menerjemahkan otomatis saat Anda menempelkan (paste) tautan issue Linear |
| `rfc.publish` | `true` | Memposting RFC ke Linear |
| `plan.autoSplit` | `true` | Memecah issue besar menjadi sub-issue secara otomatis |
| `phases.lightLabels` | `Small Size` | Label untuk issue kecil yang mendapatkan RFC singkat |
| `phases.callGraph` | `true` | Mewajibkan Call Graph di setiap RFC lengkap |
| `start.skills` | kosong | Kemampuan (skills) tambahan untuk dijalankan di setiap tugas, misalnya `code-review` |

Lebih detail: [docs/configuration.md](docs/configuration.md).

## Opsi Instalasi

**Persyaratan:**
- Claude Code;
- Node.js 20.19 atau lebih baru;
- Linear yang terhubung ke Claude, melalui pengaturan konektor claude.ai Anda atau `/mcp`;
- GitHub CLI (`gh`) yang sudah login, hanya untuk `/review`.

**Untuk seluruh tim:** commit kode ini ke `.claude/settings.json` proyek, sehingga siapa pun yang membuka proyek akan ditawari plugin ini:

```json
{
  "extraKnownMarketplaces": {
    "actual": { "source": { "source": "github", "repo": "natserract/ai" } }
  },
  "enabledPlugins": {
    "act-sdlc@actual": true
  }
}
```

**Dari klon lokal** (pembaruan datang dengan `git pull`):

```bash
git clone https://github.com/natserract/ai.git
cd ai
claude plugin marketplace add ./
claude plugin install act-sdlc@actual
```

**Untuk mengerjakan plugin ini sendiri:**

```bash
claude --plugin-dir ./workflows/act-sdlc
```

Sumber kode plugin ada di [`workflows/act-sdlc`](https://github.com/natserract/ai/tree/main/workflows/act-sdlc). Marketplace `actual` didefinisikan di `.claude-plugin/marketplace.json` pada root repositori.

## Pelajari Lebih Lanjut

| Dokumen | Baca untuk |
| :- | :- |
| [docs/lifecycle.md](docs/lifecycle.md) | Alur kerja penuh: 7 fase, siapa melakukan apa, dan bagaimana issue bergerak |
| [docs/call-graph.md](docs/call-graph.md) | Cara menggambar dan meninjau Call Graph |
| [docs/security-review.md](docs/security-review.md) | Metode ulasan keamanan |
| [docs/configuration.md](docs/configuration.md) | Semua pengaturan, dan di mana file disimpan |
| [docs/translation.md](docs/translation.md) | Setup terjemahan, bahasa, dan penyedia |

## Segera Hadir

- **`/prototype`:** menjawab satu pertanyaan desain yang tidak jelas dengan eksperimen cepat yang bisa dibuang.
- **`/handoff`:** menyerahkan pekerjaan yang belum selesai kepada rekan tim atau sesi baru.
- **`/report-bug`:** mengubah bug produksi menjadi issue yang tertaut ke RFC penyebabnya.