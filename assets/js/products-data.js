/**
 * PetRaPet Initial Product & Category Catalog
 * Curated specialized cat nutrition, health & accessories
 */

const DEFAULT_CATEGORIES = [
  {
    id: "cat_dry_food",
    name: "غذای خشک گربه",
    slug: "Dry Cat Food",
    color: "from-orange-500 to-amber-500",
    icon: "fa-bowl-food",
    image: "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=400&q=80&fm=webp"
  },
  {
    id: "cat_wet_food",
    name: "کنسرو و پوچ لذیذ",
    slug: "Wet Food & Pouches",
    color: "from-rose-500 to-pink-500",
    icon: "fa-fish",
    image: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=400&q=80&fm=webp"
  },
  {
    id: "cat_treats",
    name: "تشویقی و بستنی گربه",
    slug: "Cat Treats & Pastes",
    color: "from-amber-400 to-orange-500",
    icon: "fa-cookie-bite",
    image: "https://images.unsplash.com/photo-1561948955-570b270e7c36?auto=format&fit=crop&w=400&q=80&fm=webp"
  },
  {
    id: "cat_supplements",
    name: "مکمل، خمیر مالت و ویتامین",
    slug: "Supplements & Care",
    color: "from-emerald-500 to-teal-600",
    icon: "fa-shield-heart",
    image: "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?auto=format&fit=crop&w=400&q=80&fm=webp"
  },
  {
    id: "cat_litter",
    name: "خاک بستر و ملزومات بهداشتی",
    slug: "Cat Litter & Hygiene",
    color: "from-blue-500 to-indigo-600",
    icon: "fa-box",
    image: "https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=400&q=80&fm=webp"
  },
  {
    id: "cat_toys",
    name: "اسباب‌بازی و لوازم خواب",
    slug: "Toys & Accessories",
    color: "from-purple-500 to-indigo-500",
    icon: "fa-paw",
    image: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=400&q=80&fm=webp"
  }
];

const DEFAULT_PRODUCTS = [
  {
    id: "fox_rc_fit32",
    name: "غذای خشک گربه رویال کنین مدل Fit 32 وزن ۲ کیلوگرم",
    categoryId: "cat_dry_food",
    stockStatus: "in_stock",
    originalPrice: 1650000,
    discountPercent: 12,
    finalPrice: 1452000,
    isFeatured: true,
    isBestSeller: true,
    isNew: false,
    image: "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=600&q=80",
    shortDesc: "فرمول اختصاصی برای گربه‌های بالغ ۱ تا ۷ سال با فعالیت بدنی متوسط",
    fullDesc: "غذای خشک رویال کنین مدل فیت ۳۲ یکی از پرطرفدارترین غذاها در جهان است. حاوی فیبرهای طبیعی برای دفع هربال (گلوله مویی)، مواد مغذی متوازن برای حفظ وزن ایده‌آل و تقویت دستگاه گوارش گربه."
  },
  {
    id: "fox_rc_kitten",
    name: "غذای خشک بچه گربه رویال کنین مدل Kitten وزن ۲ کیلوگرم",
    categoryId: "cat_dry_food",
    stockStatus: "in_stock",
    originalPrice: 1780000,
    discountPercent: 10,
    finalPrice: 1602000,
    isFeatured: true,
    isBestSeller: true,
    isNew: true,
    image: "https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=600&q=80",
    shortDesc: "مناسب برای بچه گربه‌های ۴ تا ۱۲ ماهه جهت رشد استخوان و سیستم ایمنی",
    fullDesc: "غنی از آنتی‌اکسیدان‌ها و ویتامین E برای رشد سلامت بچه گربه، هضم بسیار راحت به کمک پروتئین‌های LIP با قابلیت جذب بالا و تقویت کننده ایمنی طبیعی بدن."
  },
  {
    id: "fox_rc_urinary",
    name: "غذای درمانی مجاری ادراری رویال کنین Urinary S/O وزن ۱.۵ کیلوگرم",
    categoryId: "cat_dry_food",
    stockStatus: "in_stock",
    originalPrice: 1950000,
    discountPercent: 8,
    finalPrice: 1794000,
    isFeatured: true,
    isBestSeller: false,
    isNew: false,
    image: "https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&w=600&q=80",
    shortDesc: "درمان و جلوگیری از تشکیل سنگ‌های استروویت و اگزالات کلسیم",
    fullDesc: "فرمولاسیون پزشکی و دامپزشکی برای حل کردن سنگ‌های مثانه و بهبود سلامت سیستم ادراری در گربه‌های دارای بیماری FLUTD."
  },
  {
    id: "fox_gimcat_malt",
    name: "خمیر مالت اکسترا جیم کت (GimCat) ضد گلوله مو وزن ۱۰۰ گرم",
    categoryId: "cat_supplements",
    stockStatus: "in_stock",
    originalPrice: 580000,
    discountPercent: 15,
    finalPrice: 493000,
    isFeatured: true,
    isBestSeller: true,
    isNew: false,
    image: "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?auto=format&fit=crop&w=600&q=80",
    shortDesc: "جلوگیری موثر از تجمع مو در معده گربه با مالت طبیعی، روغن و فیبر بالا",
    fullDesc: "خمیر مالت اکسترا جیم کت آلمان به دفع طبیعی موهای بلعیده شده کمک کرده و مانع از استفراغ و یبوست گربه می‌شود. فاقد شکر افزوده و بسیار خوش‌خوراک."
  },
  {
    id: "fox_schesir_tuna",
    name: "کنسرو فیله تن ماهی و میگو طبیعی شسیر (Schesir) وزن ۸۵ گرم",
    categoryId: "cat_wet_food",
    stockStatus: "in_stock",
    originalPrice: 195000,
    discountPercent: 0,
    finalPrice: 195000,
    isFeatured: false,
    isBestSeller: true,
    isNew: true,
    image: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80",
    shortDesc: "۱۰۰٪ فیله ماهی طبیعی، بدون رنگ و مواد نگهدارنده مصنوعی",
    fullDesc: "غذای تر پریمیوم تولید ایتالیا با گوشت تازه ماهی تن صید شده پایدار و میگوی تازه در ژله سبک. آبرسانی عالی به بدن گربه‌ها."
  },
  {
    id: "fox_wanpy_creamy",
    name: "پک تشویقی بستنی مایع وانپی (Wanpy) طعم مرغ و خرچنگ ۵ عددی",
    categoryId: "cat_treats",
    stockStatus: "in_stock",
    originalPrice: 220000,
    discountPercent: 14,
    finalPrice: 189000,
    isFeatured: true,
    isBestSeller: true,
    isNew: false,
    image: "https://images.unsplash.com/photo-1561948955-570b270e7c36?auto=format&fit=crop&w=600&q=80",
    shortDesc: "تشویقی مایع فوق‌العاده لذیذ، غنی شده با تائورین و ویتامین‌ها",
    fullDesc: "محبوب‌ترین میان‌وعده گربه‌ها برای دادن قرص، تقویت اشتها، آموزش و ایجاد رابطه عاطفی صمیمی با گربه."
  },
  {
    id: "fox_bentonite_litter",
    name: "خاک بستر کربن‌دار سوپر کلامپینگ ون کت (Van Cat) وزن ۱۰ کیلوگرم",
    categoryId: "cat_litter",
    stockStatus: "in_stock",
    originalPrice: 620000,
    discountPercent: 10,
    finalPrice: 558000,
    isFeatured: false,
    isBestSeller: true,
    isNew: false,
    image: "https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=600&q=80",
    shortDesc: "جذب بوی فوق‌العاده با کربن فعال، ۹۹.۵٪ بدون گرد و غبار",
    fullDesc: "بنتونیت طبیعی سدیمی با قدرت کلامپینگ (گلوله‌شدن) فوری و محکم، آنتی‌باکتریال و بهداشتی برای حفاظت از دست و پای ظریف گربه."
  },
  {
    id: "fox_laser_toy",
    name: "اسباب‌بازی لیزر اتوماتیک ۳۶۰ درجه گربه مدل Smart Paw",
    categoryId: "cat_toys",
    stockStatus: "low_stock",
    originalPrice: 790000,
    discountPercent: 20,
    finalPrice: 632000,
    isFeatured: true,
    isBestSeller: false,
    isNew: true,
    image: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=600&q=80",
    shortDesc: "دارای تایمر خودکار و ۳ حالت سرعت مختلف برای تحرک و سرگرمی گربه",
    fullDesc: "حفظ شادابی و جلوگیری از اضافه وزن و افسردگی گربه‌های خانگی با الگوهای نوری تصادفی هوشمند. قابل شارژ از طریق کابل Type-C."
  }
];
