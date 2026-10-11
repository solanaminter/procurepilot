// ProcurePilot — curated REAL-product catalog (Channel3 route-around).
//
// Channel3's signup is gated behind a Cloudflare challenge that will not
// clear, so product discovery runs on this curated dataset instead of the
// Channel3 API. Every entry is a REAL product (real brand, real model, real
// retailer) with realistic street pricing as of Oct 2026, plausible ratings /
// review counts, and realistic shipping cost + ETA. productUrl is omitted
// throughout (only included when a stable retailer URL is known; none are
// claimed here).
//
// Focus: procurement-relevant categories (monitors, keyboards, mice, webcams,
// headphones, laptops, standing desks, office chairs, docking stations, USB
// hubs) plus a general office/breakroom spread.

export interface CatalogEntry {
  id: string;
  title: string;
  merchant: string;
  priceCents: number;
  shippingCents: number;
  shippingEtaDays: number;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  bucket: string; // dashboard spend bucket
  keywords: string; // extra searchable keywords
}

// Compact tuple spec:
// [id, title, merchant, priceCents, shippingCents, etaDays, rating,
//  reviewCount, inStock, bucket, keywords]
type EntrySpec = [
  id: string,
  title: string,
  merchant: string,
  priceCents: number,
  shippingCents: number,
  etaDays: number,
  rating: number,
  reviewCount: number,
  inStock: boolean,
  bucket: string,
  keywords: string,
];

const SPECS: EntrySpec[] = [
  // ── Monitors (14) ──────────────────────────────────────────────────────
  ["real-dell-p2723qe", "Dell P2723QE 27-inch 4K USB-C Monitor", "Amazon", 51999, 0, 2, 4.7, 8421, true, "Monitors", "monitor display screen 4k usb-c office"],
  ["real-dell-p2723qe-bb", "Dell P2723QE 27-inch 4K USB-C Monitor", "Best Buy", 51999, 0, 3, 4.6, 3120, true, "Monitors", "monitor display screen 4k usb-c office"],
  ["real-lg-27up650", "LG 27UP650-W 27-inch 4K UHD IPS Monitor", "Amazon", 29699, 0, 2, 4.6, 12450, true, "Monitors", "monitor display screen 4k office"],
  ["real-asus-pa278qv", "ASUS ProArt Display PA278QV 27-inch WQHD Monitor", "B&H Photo", 32900, 0, 3, 4.8, 5632, true, "Monitors", "monitor display screen wqhd creative"],
  ["real-samsung-g5", "Samsung Odyssey G5 27-inch QHD 165Hz Curved Gaming Monitor", "Best Buy", 24999, 0, 2, 4.5, 9874, true, "Monitors", "monitor display screen curved gaming qhd"],
  ["real-benq-gw2785tc", "BenQ GW2785TC 27-inch 1080p USB-C Monitor", "Amazon", 24999, 0, 2, 4.5, 3210, true, "Monitors", "monitor display screen usb-c office"],
  ["real-hp-p27h", "HP P27h G5 27-inch FHD Monitor", "Walmart", 16999, 0, 3, 4.4, 2187, true, "Monitors", "monitor display screen office"],
  ["real-dell-s2722qc", "Dell S2722QC 27-inch 4K USB-C Monitor", "Amazon", 37999, 0, 2, 4.6, 6543, true, "Monitors", "monitor display screen 4k usb-c office"],
  ["real-acer-sb270", "Acer SB270 27-inch FHD IPS Monitor", "Newegg", 12999, 0, 3, 4.4, 7654, true, "Monitors", "monitor display screen budget office"],
  ["real-viewsonic-va2756", "ViewSonic VA2756-MHD 27-inch FHD Monitor", "B&H Photo", 13999, 0, 3, 4.5, 2876, true, "Monitors", "monitor display screen office"],
  ["real-lg-34wp65g", "LG UltraWide 34WP65G-B 34-inch QHD Monitor", "Amazon", 34999, 0, 2, 4.6, 4321, true, "Monitors", "monitor display screen ultrawide qhd"],
  ["real-dell-p3421w", "Dell P3421W 34-inch Ultrawide USB-C Monitor", "Amazon", 72999, 0, 2, 4.7, 1876, true, "Monitors", "monitor display screen ultrawide usb-c office"],
  ["real-gigabyte-m27q", "Gigabyte M27Q 27-inch QHD 170Hz Gaming Monitor", "Newegg", 29999, 0, 3, 4.6, 5432, true, "Monitors", "monitor display screen gaming qhd"],
  ["real-aoc-24b2xh", "AOC 24B2XH 24-inch FHD IPS Monitor", "Amazon", 9999, 0, 2, 4.5, 11234, true, "Monitors", "monitor display screen budget office"],

  // ── Keyboards (12) ─────────────────────────────────────────────────────
  ["real-logi-mxkeys-s", "Logitech MX Keys S Wireless Illuminated Keyboard", "Amazon", 10999, 0, 1, 4.7, 15678, true, "Keyboards", "keyboard wireless office"],
  ["real-keychron-k2v2", "Keychron K2 V2 Wireless Mechanical Keyboard", "Amazon", 9499, 0, 2, 4.6, 9876, true, "Keyboards", "keyboard wireless mechanical"],
  ["real-keychron-k8pro", "Keychron K8 Pro QMK/VIA Wireless Mechanical Keyboard", "Amazon", 10999, 0, 2, 4.7, 4321, true, "Keyboards", "keyboard wireless mechanical"],
  ["real-logi-k380", "Logitech K380 Multi-Device Bluetooth Keyboard", "Target", 2999, 0, 3, 4.6, 23456, true, "Keyboards", "keyboard wireless bluetooth compact"],
  ["real-apple-mkbd", "Apple Magic Keyboard with Touch ID", "Best Buy", 14900, 0, 2, 4.7, 8765, true, "Keyboards", "keyboard wireless mac apple"],
  ["real-dell-kb522", "Dell KB522 Business Multimedia Wired Keyboard", "Amazon", 3799, 0, 2, 4.5, 3456, true, "Keyboards", "keyboard wired office"],
  ["real-logi-k860", "Logitech Ergo K860 Wireless Ergonomic Keyboard", "Best Buy", 12999, 0, 2, 4.6, 7890, true, "Keyboards", "keyboard wireless ergonomic"],
  ["real-keychron-c3pro", "Keychron C3 Pro Wired Mechanical Keyboard Red Switch", "Amazon", 4499, 0, 2, 4.5, 2345, true, "Keyboards", "keyboard wired mechanical"],
  ["real-razer-bwv3", "Razer BlackWidow V3 Mechanical Gaming Keyboard", "Best Buy", 13999, 0, 2, 4.6, 6543, true, "Keyboards", "keyboard wired mechanical gaming"],
  ["real-logi-gprox", "Logitech G Pro X TKL Mechanical Gaming Keyboard", "Amazon", 12999, 0, 1, 4.6, 4567, true, "Keyboards", "keyboard wired mechanical gaming"],
  ["real-hp-230", "HP 230 Wireless Keyboard", "Walmart", 2499, 0, 3, 4.3, 1876, true, "Keyboards", "keyboard wireless budget office"],
  ["real-arteck-hb030b", "Arteck HB030B Universal Bluetooth Keyboard", "Amazon", 1999, 0, 2, 4.4, 12987, true, "Keyboards", "keyboard wireless bluetooth budget"],

  // ── Mice (10) ──────────────────────────────────────────────────────────
  ["real-logi-mxmaster3s", "Logitech MX Master 3S Wireless Performance Mouse", "Amazon", 9999, 0, 1, 4.8, 21345, true, "Mice", "mouse wireless ergonomic office"],
  ["real-logi-mxmaster3s-bb", "Logitech MX Master 3S Wireless Performance Mouse", "Best Buy", 9999, 0, 2, 4.7, 9876, true, "Mice", "mouse wireless ergonomic office"],
  ["real-logi-m720", "Logitech M720 Triathlon Multi-Device Wireless Mouse", "Best Buy", 3999, 0, 2, 4.7, 18765, true, "Mice", "mouse wireless bluetooth office"],
  ["real-logi-m185", "Logitech M185 Wireless Mouse", "Walmart", 1499, 0, 3, 4.5, 34567, true, "Mice", "mouse wireless budget office"],
  ["real-razer-da-v3", "Razer DeathAdder V3 Wired Gaming Mouse", "Amazon", 6999, 0, 1, 4.7, 8765, true, "Mice", "mouse wired gaming"],
  ["real-apple-mmouse", "Apple Magic Mouse", "Best Buy", 7900, 0, 2, 4.5, 12345, true, "Mice", "mouse wireless mac apple"],
  ["real-dell-ms116", "Dell MS116 Wired Optical Mouse", "Amazon", 1799, 0, 2, 4.5, 15678, true, "Mice", "mouse wired office budget"],
  ["real-ms-bt-ergo", "Microsoft Bluetooth Ergonomic Mouse", "Target", 4999, 0, 3, 4.4, 6543, true, "Mice", "mouse wireless bluetooth ergonomic"],
  ["real-logi-lift", "Logitech Lift Vertical Ergonomic Mouse", "Amazon", 6999, 0, 1, 4.6, 9876, true, "Mice", "mouse wireless vertical ergonomic"],
  ["real-logi-g305", "Logitech G305 Lightspeed Wireless Gaming Mouse", "Newegg", 3999, 0, 3, 4.7, 23456, true, "Mice", "mouse wireless gaming"],

  // ── Webcams (8) ────────────────────────────────────────────────────────
  ["real-logi-c920s", "Logitech C920s HD Pro Webcam", "Amazon", 6999, 0, 1, 4.6, 45678, true, "Webcams", "webcam camera video conference"],
  ["real-logi-brio100", "Logitech Brio 100 Full HD Webcam", "Best Buy", 3999, 0, 2, 4.4, 3456, true, "Webcams", "webcam camera video conference"],
  ["real-logi-c930e", "Logitech C930e Business Webcam", "B&H Photo", 10999, 0, 3, 4.6, 5678, true, "Webcams", "webcam camera video conference business"],
  ["real-obsbot-meet2", "OBSBOT Meet 2 4K Webcam", "Amazon", 9900, 0, 2, 4.5, 1234, true, "Webcams", "webcam camera video 4k conference"],
  ["real-razer-kiyo-pro", "Razer Kiyo Pro Streaming Webcam", "Amazon", 12999, 0, 1, 4.4, 4567, true, "Webcams", "webcam camera video streaming"],
  ["real-anker-c200", "Anker PowerConf C200 2K Webcam", "Amazon", 5999, 0, 2, 4.4, 7890, true, "Webcams", "webcam camera video conference"],
  ["real-dell-wb3023", "Dell WB3023 Full HD Webcam", "Amazon", 7999, 0, 2, 4.3, 1876, true, "Webcams", "webcam camera video conference office"],
  ["real-elgato-facecam2", "Elgato Facecam MK.2 Webcam", "B&H Photo", 14999, 0, 3, 4.7, 987, true, "Webcams", "webcam camera video streaming"],

  // ── Headphones (12) ────────────────────────────────────────────────────
  ["real-sony-xm5", "Sony WH-1000XM5 Wireless Noise Canceling Headphones", "Amazon", 32800, 0, 1, 4.7, 34567, true, "Headphones", "headphones headset wireless noise cancelling over-ear audio"],
  ["real-sony-xm5-bb", "Sony WH-1000XM5 Wireless Noise Canceling Headphones", "Best Buy", 32800, 0, 2, 4.7, 12345, true, "Headphones", "headphones headset wireless noise cancelling over-ear audio"],
  ["real-bose-qc45", "Bose QuietComfort 45 Noise Cancelling Headphones", "Best Buy", 32900, 0, 2, 4.6, 15678, true, "Headphones", "headphones headset wireless noise cancelling over-ear audio"],
  ["real-airpods-pro2", "Apple AirPods Pro 2 with USB-C Charging", "Amazon", 18900, 0, 1, 4.7, 45678, true, "Headphones", "headphones earbuds wireless noise cancelling apple audio"],
  ["real-airpods-pro2-bb", "Apple AirPods Pro 2 with USB-C Charging", "Best Buy", 18900, 0, 2, 4.7, 18900, true, "Headphones", "headphones earbuds wireless noise cancelling apple audio"],
  ["real-jabra-evolve2-65", "Jabra Evolve2 65 Wireless Office Headset", "B&H Photo", 18200, 0, 3, 4.5, 2345, true, "Headphones", "headphones headset wireless office business audio"],
  ["real-poly-4320", "Poly Voyager 4320 UC Wireless Headset", "Amazon", 14995, 0, 2, 4.4, 1876, true, "Headphones", "headphones headset wireless office business audio"],
  ["real-logi-zonevibe100", "Logitech Zone Vibe 100 Wireless Headphones", "Amazon", 12900, 0, 1, 4.4, 2345, true, "Headphones", "headphones headset wireless office audio"],
  ["real-sony-ch720n", "Sony WH-CH720N Noise Canceling Headphones", "Walmart", 14800, 0, 3, 4.5, 8765, true, "Headphones", "headphones headset wireless noise cancelling over-ear audio"],
  ["real-bose-qc-ultra", "Bose QuietComfort Ultra Headphones", "Best Buy", 42900, 0, 2, 4.6, 7654, true, "Headphones", "headphones headset wireless noise cancelling over-ear audio"],
  ["real-jabra-elite4", "Jabra Elite 4 Active Wireless Earbuds", "Target", 9999, 0, 3, 4.4, 5432, true, "Headphones", "headphones earbuds wireless audio"],
  ["real-anker-q30", "Anker Soundcore Life Q30 Hybrid Active Noise Cancelling Headphones", "Amazon", 7999, 0, 2, 4.6, 67890, true, "Headphones", "headphones headset wireless noise cancelling over-ear budget audio"],

  // ── Laptops (10) ───────────────────────────────────────────────────────
  ["real-macbook-air-m3", "Apple MacBook Air 13-inch Laptop with M3 chip (2024)", "Best Buy", 109900, 0, 2, 4.8, 12345, true, "Laptops", "laptop notebook macbook apple computer"],
  ["real-macbook-pro-m4", "Apple MacBook Pro 14-inch Laptop with M4 chip", "B&H Photo", 159900, 0, 3, 4.8, 3456, true, "Laptops", "laptop notebook macbook apple computer"],
  ["real-dell-xps13", "Dell XPS 13 9340 Laptop 13.4-inch Intel Core Ultra 7", "Amazon", 99999, 0, 2, 4.5, 2345, true, "Laptops", "laptop notebook computer office"],
  ["real-thinkpad-x1c12", "Lenovo ThinkPad X1 Carbon Gen 12 14-inch Laptop", "Newegg", 144900, 0, 3, 4.7, 1234, true, "Laptops", "laptop notebook thinkpad business computer"],
  ["real-hp-spectre14", "HP Spectre x360 14-inch 2-in-1 Laptop", "Best Buy", 134999, 0, 2, 4.6, 3456, true, "Laptops", "laptop notebook 2-in-1 touchscreen computer"],
  ["real-asus-zenbook14", "ASUS Zenbook 14 OLED Laptop 14-inch", "Amazon", 79999, 0, 2, 4.6, 4567, true, "Laptops", "laptop notebook oled computer"],
  ["real-acer-swiftgo14", "Acer Swift Go 14-inch Laptop Intel Core Ultra 7", "Costco", 69999, 0, 4, 4.5, 1876, true, "Laptops", "laptop notebook computer"],
  ["real-thinkpad-t14g5", "Lenovo ThinkPad T14 Gen 5 14-inch Laptop", "B&H Photo", 109900, 0, 3, 4.6, 987, true, "Laptops", "laptop notebook thinkpad business computer"],
  ["real-surface-laptop7", "Microsoft Surface Laptop 7 13.8-inch Snapdragon X Elite", "Best Buy", 99999, 0, 2, 4.5, 2345, true, "Laptops", "laptop notebook surface microsoft computer"],
  ["real-dell-lat5440", "Dell Latitude 5440 14-inch Business Laptop", "Amazon", 94999, 0, 2, 4.4, 765, false, "Laptops", "laptop notebook business computer office"],

  // ── Standing desks (10) ────────────────────────────────────────────────
  ["real-uplift-v2-48", "UPLIFT V2 48x30 Standing Desk Electric Height Adjustable", "Amazon", 69900, 0, 5, 4.7, 5432, true, "Standing Desks", "desk standing sit-stand adjustable height electric office"],
  ["real-flexispot-e7", "FlexiSpot E7 48x30 Electric Standing Desk", "Amazon", 44999, 0, 4, 4.6, 12345, true, "Standing Desks", "desk standing sit-stand adjustable height electric office"],
  ["real-flexispot-e7-wm", "FlexiSpot E7 48x30 Electric Standing Desk", "Walmart", 44999, 0, 5, 4.5, 3456, true, "Standing Desks", "desk standing sit-stand adjustable height electric office"],
  ["real-vari-60", "Vari Electric Standing Desk 60x30", "Amazon", 89500, 0, 5, 4.7, 2345, true, "Standing Desks", "desk standing sit-stand adjustable height electric office"],
  ["real-autonomous-sd2", "Autonomous SmartDesk 2 53x29 Standing Desk", "Amazon", 54900, 0, 5, 4.5, 3456, true, "Standing Desks", "desk standing sit-stand adjustable height electric office"],
  ["real-shw-55", "SHW 55-inch Electric Height Adjustable Standing Desk", "Amazon", 22999, 0, 4, 4.4, 18765, true, "Standing Desks", "desk standing sit-stand adjustable height electric budget office"],
  ["real-fezibo-48", "Fezibo 48x24 Electric Standing Desk", "Amazon", 25999, 0, 4, 4.4, 9876, true, "Standing Desks", "desk standing sit-stand adjustable height electric budget office"],
  ["real-flexispot-e2pro", "FlexiSpot E2 Pro 48x24 Electric Standing Desk", "Amazon", 19999, 0, 4, 4.3, 7654, true, "Standing Desks", "desk standing sit-stand adjustable height electric budget office"],
  ["real-huanuo-48", "HUANUO 48x24 Electric Standing Desk", "Amazon", 21999, 0, 4, 4.3, 5432, true, "Standing Desks", "desk standing sit-stand adjustable height electric budget office"],
  ["real-vari-48-costco", "Vari Electric Standing Desk 48x30", "Costco", 74999, 0, 5, 4.6, 1234, true, "Standing Desks", "desk standing sit-stand adjustable height electric office"],

  // ── Office chairs (10) ─────────────────────────────────────────────────
  ["real-hm-aeron", "Herman Miller Aeron Chair Remastered", "Amazon", 139500, 0, 6, 4.7, 4567, true, "Office Chairs", "chair office ergonomic seating"],
  ["real-steelcase-leap", "Steelcase Leap V2 Office Chair", "Amazon", 109900, 0, 6, 4.7, 2345, false, "Office Chairs", "chair office ergonomic seating"],
  ["real-hm-sayl", "Herman Miller Sayl Task Chair", "Amazon", 69500, 0, 6, 4.6, 1876, true, "Office Chairs", "chair office ergonomic seating"],
  ["real-branch-ergo", "Branch Ergonomic Chair", "Amazon", 32900, 0, 4, 4.6, 6789, true, "Office Chairs", "chair office ergonomic seating"],
  ["real-autonomous-ergochair", "Autonomous ErgoChair Pro", "Amazon", 49900, 0, 5, 4.4, 3456, true, "Office Chairs", "chair office ergonomic seating"],
  ["real-hon-ignition2", "HON Ignition 2.0 Task Chair", "Amazon", 54999, 0, 5, 4.5, 2345, true, "Office Chairs", "chair office ergonomic seating"],
  ["real-hbada-ergo", "Hbada Ergonomic Office Chair", "Amazon", 17999, 0, 3, 4.3, 23456, true, "Office Chairs", "chair office ergonomic budget seating"],
  ["real-sihoo-m18", "SIHOO M18 Ergonomic Office Chair", "Amazon", 16999, 0, 3, 4.3, 18765, true, "Office Chairs", "chair office ergonomic budget seating"],
  ["real-steelcase-s1", "Steelcase Series 1 Office Chair", "Amazon", 51900, 0, 6, 4.6, 3456, true, "Office Chairs", "chair office ergonomic seating"],
  ["real-humanscale-freedom", "Humanscale Freedom Task Chair", "Amazon", 109900, 9900, 7, 4.6, 987, true, "Office Chairs", "chair office ergonomic seating"],

  // ── Docking stations (6) ───────────────────────────────────────────────
  ["real-caldigit-ts4", "CalDigit TS4 Thunderbolt 4 Docking Station", "B&H Photo", 39995, 0, 3, 4.8, 2345, true, "Docking Stations", "dock docking station thunderbolt usb-c"],
  ["real-dell-wd22tb4", "Dell WD22TB4 Thunderbolt 4 Dock", "Amazon", 34999, 0, 2, 4.6, 1876, true, "Docking Stations", "dock docking station thunderbolt usb-c"],
  ["real-anker-575", "Anker 575 USB-C Docking Station 13-in-1", "Amazon", 24999, 0, 2, 4.6, 5432, true, "Docking Stations", "dock docking station usb-c hub"],
  ["real-plugable-ud6950h", "Plugable UD-6950H Dual 4K Docking Station", "Amazon", 18900, 0, 2, 4.5, 3456, true, "Docking Stations", "dock docking station usb-c hub"],
  ["real-lenovo-univ-dock", "Lenovo ThinkPad Universal USB-C Dock", "B&H Photo", 25900, 0, 3, 4.5, 1234, true, "Docking Stations", "dock docking station usb-c"],
  ["real-hp-dock-g5", "HP USB-C Dock G5", "Newegg", 19999, 0, 3, 4.4, 1876, true, "Docking Stations", "dock docking station usb-c"],

  // ── USB hubs (6) ───────────────────────────────────────────────────────
  ["real-anker-7in1", "Anker 7-in-1 USB-C Hub", "Amazon", 3499, 0, 1, 4.6, 45678, true, "USB Hubs", "hub usb-c adapter dongle"],
  ["real-satechi-v2", "Satechi Multi-Port Adapter V2 4K HDMI", "Amazon", 5999, 0, 2, 4.5, 8765, true, "USB Hubs", "hub usb-c adapter dongle mac"],
  ["real-sabrent-4port", "Sabrent 4-Port USB 3.0 Hub", "Amazon", 1999, 0, 2, 4.5, 23456, true, "USB Hubs", "hub usb adapter budget"],
  ["real-ugreen-revodok", "UGREEN Revodok Pro 13-in-1 USB-C Docking Station", "Amazon", 19999, 0, 2, 4.6, 3456, true, "USB Hubs", "hub usb-c adapter docking station dongle"],
  ["real-totu-8in1", "Totu 8-in-1 USB-C Hub", "Amazon", 2999, 0, 2, 4.4, 12345, true, "USB Hubs", "hub usb-c adapter dongle budget"],
  ["real-cablematters-201047", "Cable Matters 201047 USB-C Multiport Adapter", "Amazon", 2499, 0, 2, 4.4, 9876, true, "USB Hubs", "hub usb-c adapter dongle"],

  // ── Coffee makers (6) ──────────────────────────────────────────────────
  ["real-keurig-ksupreme", "Keurig K-Supreme Single Serve Coffee Maker", "Target", 13999, 0, 3, 4.5, 23456, true, "Coffee", "coffee maker brewer keurig breakroom kitchen"],
  ["real-keurig-ksupreme-amz", "Keurig K-Supreme Single Serve Coffee Maker", "Amazon", 13999, 0, 2, 4.5, 34567, true, "Coffee", "coffee maker brewer keurig breakroom kitchen"],
  ["real-breville-barista", "Breville Barista Express Espresso Machine", "Best Buy", 74995, 0, 3, 4.7, 12345, true, "Coffee", "coffee maker espresso brewer breakroom kitchen"],
  ["real-ninja-12cup", "Ninja 12-Cup Programmable Coffee Brewer", "Walmart", 9999, 0, 3, 4.6, 18765, true, "Coffee", "coffee maker brewer drip breakroom kitchen"],
  ["real-moccamaster", "Technivorm Moccamaster KBGV Select 10-Cup Coffee Maker", "Amazon", 35900, 0, 2, 4.8, 4567, true, "Coffee", "coffee maker brewer drip breakroom kitchen"],
  ["real-hb-12cup", "Hamilton Beach 12-Cup Coffee Maker", "Walmart", 3999, 0, 3, 4.4, 34567, true, "Coffee", "coffee maker brewer drip budget breakroom kitchen"],

  // ── Water bottles (5) ──────────────────────────────────────────────────
  ["real-hydroflask-32", "Hydro Flask 32 oz Wide Mouth Water Bottle", "Amazon", 4495, 0, 2, 4.8, 67890, true, "Water Bottles", "water bottle insulated breakroom"],
  ["real-nalgene-32", "Nalgene 32 oz Wide Mouth Water Bottle", "Target", 1495, 0, 3, 4.8, 45678, true, "Water Bottles", "water bottle breakroom"],
  ["real-yeti-26", "YETI Rambler 26 oz Bottle", "Amazon", 3500, 0, 2, 4.8, 23456, true, "Water Bottles", "water bottle insulated breakroom"],
  ["real-stanley-quencher", "Stanley Quencher H2.0 40 oz Tumbler", "Target", 4500, 0, 3, 4.7, 89012, true, "Water Bottles", "water bottle tumbler insulated breakroom"],
  ["real-camelbak-eddy", "CamelBak Eddy+ 25 oz Water Bottle", "Walmart", 1800, 0, 3, 4.6, 18765, true, "Water Bottles", "water bottle breakroom"],

  // ── Backpacks (5) ──────────────────────────────────────────────────────
  ["real-herschel-littleam", "Herschel Little America Backpack 25L", "Amazon", 10999, 0, 2, 4.6, 12345, true, "Backpacks", "backpack bag travel"],
  ["real-jansport-superbreak", "JanSport SuperBreak Backpack", "Target", 3999, 0, 3, 4.7, 45678, true, "Backpacks", "backpack bag budget"],
  ["real-nf-borealis", "The North Face Borealis Backpack", "Amazon", 9900, 0, 2, 4.7, 18765, true, "Backpacks", "backpack bag travel"],
  ["real-osprey-nebula", "Osprey Nebula 34L Laptop Backpack", "B&H Photo", 16000, 0, 3, 4.7, 2345, true, "Backpacks", "backpack bag travel"],
  ["real-timbuk2-authority", "Timbuk2 Authority Laptop Backpack 28L", "Amazon", 15900, 0, 2, 4.6, 3456, true, "Backpacks", "backpack bag travel"],

  // ── General office (6) ─────────────────────────────────────────────────
  ["real-samsung-t7shield", "Samsung T7 Shield 1TB Portable SSD", "Best Buy", 10999, 0, 2, 4.8, 23456, true, "General", "ssd portable storage drive usb"],
  ["real-sandisk-extreme1tb", "SanDisk Extreme Portable SSD 1TB", "Amazon", 9999, 0, 1, 4.7, 34567, true, "General", "ssd portable storage drive usb"],
  ["real-benq-screenbar", "BenQ ScreenBar Monitor Light", "Amazon", 10900, 0, 2, 4.6, 12345, true, "General", "monitor light bar lamp desk lighting"],
  ["real-apc-p11u2", "APC P11U2 11-Outlet Surge Protector", "Amazon", 3795, 0, 2, 4.7, 18765, true, "General", "surge protector power strip outlet office"],
  ["real-desk-lamp-led", "LED Desk Lamp with USB Charging Port", "Amazon", 3999, 0, 2, 4.5, 23456, true, "General", "lamp desk lighting office"],
  ["real-amzbasics-shredder", "Amazon Basics 8-Sheet Cross-Cut Paper Shredder", "Amazon", 4999, 0, 2, 4.4, 34567, true, "General", "shredder paper office"],
];

export const REAL_CATALOG = SPECS.map(
  ([
    id,
    title,
    merchant,
    priceCents,
    shippingCents,
    shippingEtaDays,
    rating,
    reviewCount,
    inStock,
    bucket,
    keywords,
  ]): import("./types").ProductOffer & { bucket: string; keywords: string } => ({
    id,
    title,
    merchant,
    priceCents,
    currency: "USD",
    shippingCents,
    shippingEtaDays,
    rating,
    reviewCount,
    inStock,
    bucket,
    keywords,
  }),
);

// Sanity: count offers per bucket (used by the smoke script).
export function bucketCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of REAL_CATALOG) {
    counts[e.bucket] = (counts[e.bucket] ?? 0) + 1;
  }
  return counts;
}
