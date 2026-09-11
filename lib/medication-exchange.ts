export type CountryCode = 'VN' | 'IN' | 'US' | 'CN';
export type AccessClass = 'otc' | 'rx' | 'verify';

export type CountryMedication = {
  exampleName: string;
  localIngredient: string;
  strength: string;
  form: string;
  access: AccessClass;
  accessNote: string;
};

export type MedicationExchange = {
  id: string;
  inn: string;
  atc: string;
  purpose: string;
  safetyNote: string;
  excipientWatch: string;
  pharmacistChecks: string[];
  products: Record<CountryCode, CountryMedication>;
};

export const COUNTRIES: Record<
  CountryCode,
  {
    name: string;
    flag: string;
    regulator: string;
    registryUrl: string;
    accessContext: string;
  }
> = {
  VN: {
    name: 'Việt Nam',
    flag: '🇻🇳',
    regulator: 'Cục Quản lý Dược — Bộ Y tế',
    registryUrl: 'https://dichvucong.dav.gov.vn/congbothuockhongkedon',
    accessContext:
      'Phải kiểm tra đúng số đăng ký, hàm lượng, dạng bào chế và nhãn kê đơn/không kê đơn của sản phẩm đang bán.',
  },
  IN: {
    name: 'Ấn Độ',
    flag: '🇮🇳',
    regulator: 'CDSCO',
    registryUrl: 'https://cdsco.gov.in/opencms/opencms/en/Acts-Rules/',
    accessContext:
      'Ấn Độ không có một danh mục OTC pháp định duy nhất; OTC* trong demo nghĩa là sản phẩm không được đánh dấu Rx trong bộ dữ liệu mẫu. Vẫn phải hỏi pharmacist và xem Schedule H/H1/X trên nhãn.',
  },
  US: {
    name: 'Mỹ',
    flag: '🇺🇸',
    regulator: 'U.S. FDA',
    registryUrl: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm',
    accessContext:
      'Rx/OTC áp dụng cho đúng sản phẩm, hàm lượng và dạng dùng được FDA ghi nhận; cùng hoạt chất có thể có cả bản Rx và OTC.',
  },
  CN: {
    name: 'Trung Quốc',
    flag: '🇨🇳',
    regulator: 'NMPA',
    registryUrl: 'https://zwfw.nmpa.gov.cn/web/taskdir/one',
    accessContext:
      'Phân loại được quản lý theo sản phẩm. Hãy kiểm tra nhãn OTC/Rx, số phê duyệt và hướng dẫn tiếng Trung hiện hành.',
  },
};

const p = (
  exampleName: string,
  localIngredient: string,
  strength: string,
  form: string,
  access: AccessClass,
  accessNote: string,
): CountryMedication => ({
  exampleName,
  localIngredient,
  strength,
  form,
  access,
  accessNote,
});

const vnOtc =
  'Ví dụ không kê đơn trong demo; xác minh đúng sản phẩm trên nhãn/Cục Quản lý Dược.';
const indiaOtc =
  'OTC* trong demo; Ấn Độ không có một danh mục OTC pháp định duy nhất. Kiểm tra nhãn và hỏi pharmacist.';
const usOtc =
  'Không kê đơn cho đúng hàm lượng và dạng dùng được nêu; đọc Drug Facts trước khi dùng.';
const chinaOtc =
  'Ví dụ OTC trong demo; xác minh ký hiệu OTC và hướng dẫn của đúng sản phẩm.';
const rx =
  'Cần đơn và đánh giá của người kê đơn; không dùng đơn cũ để tự mua ở quốc gia khác.';
const verify =
  'Phân loại có thể khác theo sản phẩm, hàm lượng hoặc kênh bán; pharmacist phải xác minh trước khi mua.';

export const MEDICATION_EXCHANGES: MedicationExchange[] = [
  {
    id: 'paracetamol',
    inn: 'Paracetamol (acetaminophen)',
    atc: 'N02BE01',
    purpose: 'Giảm đau, hạ sốt',
    safetyNote:
      'Quá liều hoặc dùng trùng nhiều thuốc cảm có cùng hoạt chất có thể gây tổn thương gan nghiêm trọng.',
    excipientWatch:
      'Dạng sủi, siro, viên nhai và viên nang có thể khác về natri, đường/chất tạo ngọt, màu, hương hoặc gelatin.',
    pharmacistChecks: [
      'Tổng liều paracetamol/acetaminophen từ mọi sản phẩm',
      'Bệnh gan hoặc sử dụng rượu thường xuyên',
      'Sản phẩm cảm cúm phối hợp có APAP/paracetamol',
    ],
    products: {
      VN: p(
        'Panadol 500 mg',
        'Paracetamol',
        '500 mg',
        'Viên nén giải phóng tức thì',
        'otc',
        vnOtc,
      ),
      IN: p(
        'Crocin 500',
        'Paracetamol',
        '500 mg',
        'Viên nén giải phóng tức thì',
        'otc',
        indiaOtc,
      ),
      US: p(
        'Tylenol Extra Strength',
        'Acetaminophen',
        '500 mg',
        'Viên nén/caplet giải phóng tức thì',
        'otc',
        usOtc,
      ),
      CN: p(
        '必理通 Panadol',
        '对乙酰氨基酚',
        '500 mg',
        'Viên nén giải phóng tức thì',
        'otc',
        chinaOtc,
      ),
    },
  },
  {
    id: 'ibuprofen',
    inn: 'Ibuprofen',
    atc: 'M01AE01',
    purpose: 'Giảm đau, hạ sốt, chống viêm',
    safetyNote:
      'Có thể gây chảy máu tiêu hóa, tổn thương thận và tăng nguy cơ tim mạch; rủi ro tăng khi dùng liều cao hoặc kéo dài.',
    excipientWatch:
      'Viên nang mềm thường có gelatin; hỗn dịch có thể chứa màu, hương, đường hoặc chất tạo ngọt khác nhau.',
    pharmacistChecks: [
      'Tiền sử loét/chảy máu dạ dày',
      'Bệnh thận, tim mạch hoặc thuốc chống đông',
      'Mang thai, đặc biệt từ tuần 20 trở đi',
    ],
    products: {
      VN: p(
        'Nurofen 200 mg',
        'Ibuprofen',
        '200 mg',
        'Viên nén giải phóng tức thì',
        'otc',
        vnOtc,
      ),
      IN: p(
        'Brufen 200',
        'Ibuprofen',
        '200 mg',
        'Viên nén giải phóng tức thì',
        'otc',
        indiaOtc,
      ),
      US: p(
        'Advil 200 mg',
        'Ibuprofen',
        '200 mg',
        'Viên nén giải phóng tức thì',
        'otc',
        usOtc,
      ),
      CN: p(
        '布洛芬片',
        '布洛芬',
        '200 mg',
        'Viên nén giải phóng tức thì',
        'otc',
        chinaOtc,
      ),
    },
  },
  {
    id: 'cetirizine',
    inn: 'Cetirizine',
    atc: 'R06AE07',
    purpose: 'Giảm triệu chứng dị ứng',
    safetyNote:
      'Có thể gây buồn ngủ hoặc giảm tỉnh táo; rượu và thuốc an thần có thể làm tác dụng này mạnh hơn.',
    excipientWatch:
      'Dung dịch và viên nhai có thể khác về hương, màu, lactose, sucrose hoặc chất tạo ngọt.',
    pharmacistChecks: [
      'Buồn ngủ khi lái xe/vận hành máy',
      'Bệnh thận cần xem lại liều',
      'Đúng cetirizine đơn chất, không phải thuốc cảm phối hợp',
    ],
    products: {
      VN: p(
        'Zyrtec 10 mg',
        'Cetirizine dihydrochloride',
        '10 mg',
        'Viên nén bao phim',
        'otc',
        vnOtc,
      ),
      IN: p(
        'Cetzine 10 mg',
        'Cetirizine hydrochloride',
        '10 mg',
        'Viên nén bao phim',
        'verify',
        verify,
      ),
      US: p(
        'Zyrtec 10 mg',
        'Cetirizine hydrochloride',
        '10 mg',
        'Viên nén',
        'otc',
        usOtc,
      ),
      CN: p(
        '仙特明 Zyrtec',
        '盐酸西替利嗪',
        '10 mg',
        'Viên nén',
        'otc',
        chinaOtc,
      ),
    },
  },
  {
    id: 'loratadine',
    inn: 'Loratadine',
    atc: 'R06AX13',
    purpose: 'Giảm viêm mũi dị ứng và mề đay',
    safetyNote:
      'Đau đầu, khô miệng hoặc buồn ngủ vẫn có thể xảy ra dù thường ít an thần hơn một số thuốc dị ứng khác.',
    excipientWatch:
      'Viên tan nhanh có thể chứa aspartame; siro và viên nén có thể khác về đường, màu, hương hoặc lactose.',
    pharmacistChecks: [
      'Bệnh gan nặng',
      'Dạng viên tan nhanh nếu có phenylketonuria',
      'Không dùng trùng với thuốc dị ứng phối hợp',
    ],
    products: {
      VN: p('Clarityne 10 mg', 'Loratadine', '10 mg', 'Viên nén', 'otc', vnOtc),
      IN: p(
        'Lorfast 10 mg',
        'Loratadine',
        '10 mg',
        'Viên nén',
        'otc',
        indiaOtc,
      ),
      US: p('Claritin 10 mg', 'Loratadine', '10 mg', 'Viên nén', 'otc', usOtc),
      CN: p(
        '开瑞坦 Claritin',
        '氯雷他定',
        '10 mg',
        'Viên nén',
        'otc',
        chinaOtc,
      ),
    },
  },
  {
    id: 'omeprazole',
    inn: 'Omeprazole',
    atc: 'A02BC01',
    purpose: 'Giảm acid dạ dày',
    safetyNote:
      'Không nên dùng kéo dài chỉ dựa vào tên thuốc; triệu chứng dai dẳng, nuốt khó, chảy máu hoặc sụt cân cần được khám.',
    excipientWatch:
      'Hạt bao tan trong ruột và vỏ nang có hệ tá dược/cơ chế giải phóng riêng; không nghiền hoặc đổi dạng tùy ý.',
    pharmacistChecks: [
      'Thời gian dùng và lý do dùng',
      'Tương tác, gồm một số thuốc chống kết tập tiểu cầu',
      'Đúng dạng giải phóng chậm/bao tan trong ruột',
    ],
    products: {
      VN: p(
        'Losec MUPS 20 mg',
        'Omeprazole',
        '20 mg',
        'Viên bao tan trong ruột',
        'verify',
        verify,
      ),
      IN: p(
        'Omez 20 mg',
        'Omeprazole',
        '20 mg',
        'Viên nang giải phóng chậm',
        'rx',
        rx,
      ),
      US: p(
        'Prilosec OTC 20 mg',
        'Omeprazole magnesium',
        '20 mg',
        'Viên giải phóng chậm, liệu trình OTC',
        'otc',
        usOtc,
      ),
      CN: p(
        '洛赛克 Losec 20 mg',
        '奥美拉唑',
        '20 mg',
        'Viên bao tan trong ruột',
        'verify',
        verify,
      ),
    },
  },
  {
    id: 'famotidine',
    inn: 'Famotidine',
    atc: 'A02BA03',
    purpose: 'Giảm acid/ợ nóng',
    safetyNote:
      'Có thể gây đau đầu, chóng mặt hoặc táo bón; người suy thận có thể cần điều chỉnh liều.',
    excipientWatch:
      'Viên nhai và hỗn dịch có thể chứa calcium/magnesium, hương, màu, sucrose hoặc chất tạo ngọt khác.',
    pharmacistChecks: [
      'Chức năng thận',
      'Triệu chứng kéo dài hoặc tái diễn',
      'Sản phẩm đơn chất hay phối hợp antacid',
    ],
    products: {
      VN: p(
        'Famotidine 20 mg',
        'Famotidine',
        '20 mg',
        'Viên nén bao phim',
        'verify',
        verify,
      ),
      IN: p('Famocid 20', 'Famotidine', '20 mg', 'Viên nén', 'rx', rx),
      US: p('Pepcid AC 20 mg', 'Famotidine', '20 mg', 'Viên nén', 'otc', usOtc),
      CN: p('法莫替丁片', '法莫替丁', '20 mg', 'Viên nén', 'verify', verify),
    },
  },
  {
    id: 'loperamide',
    inn: 'Loperamide',
    atc: 'A07DA03',
    purpose: 'Giảm tiêu chảy ngắn hạn',
    safetyNote:
      'Dùng quá liều có thể gây rối loạn nhịp tim nguy hiểm; tiêu chảy kèm sốt cao hoặc phân có máu cần được đánh giá y tế.',
    excipientWatch:
      'Viên tan và dung dịch có thể khác về aspartame, màu, hương, cồn hoặc đường.',
    pharmacistChecks: [
      'Sốt, phân máu/đen hoặc đau bụng chướng',
      'Tuổi người dùng và thời gian tiêu chảy',
      'Không vượt liều ghi trên nhãn',
    ],
    products: {
      VN: p(
        'Imodium 2 mg',
        'Loperamide hydrochloride',
        '2 mg',
        'Viên nang',
        'otc',
        vnOtc,
      ),
      IN: p(
        'Eldoper 2 mg',
        'Loperamide hydrochloride',
        '2 mg',
        'Viên nang',
        'otc',
        indiaOtc,
      ),
      US: p(
        'Imodium A-D 2 mg',
        'Loperamide hydrochloride',
        '2 mg',
        'Viên nang mềm/caplet',
        'otc',
        usOtc,
      ),
      CN: p(
        '易蒙停 Imodium',
        '盐酸洛哌丁胺',
        '2 mg',
        'Viên nang',
        'otc',
        chinaOtc,
      ),
    },
  },
  {
    id: 'dextromethorphan',
    inn: 'Dextromethorphan',
    atc: 'R05DA09',
    purpose: 'Giảm ho khan',
    safetyNote:
      'Có thể gây buồn ngủ; dùng với MAOI hoặc một số thuốc tăng serotonin có thể nguy hiểm. Dùng quá mức có nguy cơ ngộ độc/lạm dụng.',
    excipientWatch:
      'Siro dễ khác về cồn, đường, sorbitol, màu và hương; thuốc cảm phối hợp có thể thêm paracetamol hoặc kháng histamine.',
    pharmacistChecks: [
      'Đơn chất hay thuốc cảm phối hợp',
      'Thuốc chống trầm cảm/MAOI đang dùng',
      'Tại Trung Quốc, chế phẩm uống đơn chất được quản lý theo đơn và kiểm soát chặt',
    ],
    products: {
      VN: p(
        'Dextromethorphan HBr',
        'Dextromethorphan hydrobromide',
        '15 mg/5 mL',
        'Siro uống đơn chất',
        'otc',
        vnOtc,
      ),
      IN: p(
        'Dextromethorphan HBr syrup',
        'Dextromethorphan hydrobromide',
        '15 mg/5 mL',
        'Siro uống đơn chất',
        'verify',
        verify,
      ),
      US: p(
        'Delsym',
        'Dextromethorphan polistirex',
        '30 mg/5 mL',
        'Hỗn dịch giải phóng kéo dài',
        'otc',
        usOtc,
      ),
      CN: p(
        '右美沙芬口服单方制剂',
        '右美沙芬',
        'Theo đơn',
        'Chế phẩm uống đơn chất',
        'rx',
        'Chế phẩm uống đơn chất đã chuyển sang thuốc kê đơn; phải xác minh quy định kiểm soát hiện hành.',
      ),
    },
  },
  {
    id: 'clotrimazole',
    inn: 'Clotrimazole',
    atc: 'D01AC01',
    purpose: 'Điều trị nấm da tại chỗ',
    safetyNote:
      'Có thể gây rát, đỏ hoặc kích ứng tại chỗ; không dùng nhầm kem bôi da cho mắt, miệng hoặc đường âm đạo.',
    excipientWatch:
      'Nền kem có thể khác về benzyl alcohol, cetyl/stearyl alcohol, propylene glycol hoặc chất bảo quản.',
    pharmacistChecks: [
      'Đúng vị trí và dạng dùng',
      'Da trầy rộng, nhiễm trùng hoặc triệu chứng không cải thiện',
      'Tiền sử dị ứng với nền kem/chất bảo quản',
    ],
    products: {
      VN: p('Canesten 1%', 'Clotrimazole', '1%', 'Kem bôi da', 'otc', vnOtc),
      IN: p('Candid 1%', 'Clotrimazole', '1%', 'Kem bôi da', 'otc', indiaOtc),
      US: p('Lotrimin AF 1%', 'Clotrimazole', '1%', 'Kem bôi da', 'otc', usOtc),
      CN: p('克霉唑乳膏 1%', '克霉唑', '1%', 'Kem bôi da', 'otc', chinaOtc),
    },
  },
  {
    id: 'hydrocortisone',
    inn: 'Hydrocortisone (topical)',
    atc: 'D07AA02',
    purpose: 'Giảm ngứa/viêm da nhẹ',
    safetyNote:
      'Dùng quá mức có thể làm mỏng da hoặc che lấp nhiễm trùng; vị trí bôi và thời gian dùng cần được giới hạn.',
    excipientWatch:
      'Kem, mỡ và lotion có nền tá dược rất khác; lanolin, propylene glycol, parabens hoặc cồn béo có thể gây kích ứng ở một số người.',
    pharmacistChecks: [
      'Có dấu hiệu nhiễm trùng, nấm hoặc vết thương hở',
      'Bôi lên mặt, vùng sinh dục hoặc cho trẻ nhỏ',
      'Đúng nồng độ 1% và đúng nền kem/mỡ',
    ],
    products: {
      VN: p(
        'Hydrocortisone 1%',
        'Hydrocortisone',
        '1%',
        'Kem bôi da',
        'verify',
        verify,
      ),
      IN: p(
        'Hydrocortisone 1%',
        'Hydrocortisone',
        '1%',
        'Kem bôi da',
        'rx',
        rx,
      ),
      US: p('Cortizone-10', 'Hydrocortisone', '1%', 'Kem bôi da', 'otc', usOtc),
      CN: p(
        '氢化可的松乳膏 1%',
        '氢化可的松',
        '1%',
        'Kem bôi da',
        'verify',
        verify,
      ),
    },
  },
  {
    id: 'amoxicillin',
    inn: 'Amoxicillin',
    atc: 'J01CA04',
    purpose: 'Kháng sinh penicillin cho nhiễm khuẩn phù hợp',
    safetyNote:
      'Có thể gây phản ứng dị ứng nghiêm trọng và tiêu chảy; không điều trị virus và không nên dùng phần thuốc còn lại từ đơn cũ.',
    excipientWatch:
      'Bột pha hỗn dịch, vỏ nang và hương liệu khác nhau; người dị ứng penicillin/cephalosporin cần được đánh giá trước.',
    pharmacistChecks: [
      'Dị ứng penicillin hoặc cephalosporin',
      'Chẩn đoán, liều, khoảng cách dùng và đủ liệu trình',
      'Chức năng thận và tương tác thuốc',
    ],
    products: {
      VN: p(
        'Amoxil 500 mg',
        'Amoxicillin trihydrate',
        '500 mg',
        'Viên nang',
        'rx',
        rx,
      ),
      IN: p(
        'Novamox 500',
        'Amoxicillin trihydrate',
        '500 mg',
        'Viên nang',
        'rx',
        rx,
      ),
      US: p(
        'Amoxicillin 500 mg',
        'Amoxicillin',
        '500 mg',
        'Viên nang',
        'rx',
        rx,
      ),
      CN: p('阿莫仙 500 mg', '阿莫西林', '500 mg', 'Viên nang', 'rx', rx),
    },
  },
  {
    id: 'azithromycin',
    inn: 'Azithromycin',
    atc: 'J01FA10',
    purpose: 'Kháng sinh macrolide cho nhiễm khuẩn phù hợp',
    safetyNote:
      'Có thể gây tiêu chảy và kéo dài QT/rối loạn nhịp ở người có nguy cơ; không dùng để tự điều trị cảm cúm.',
    excipientWatch:
      'Viên và hỗn dịch có màu, hương, sucrose hoặc nền bao phim khác nhau; hàm lượng 250 mg và 500 mg không hoán đổi liều tùy ý.',
    pharmacistChecks: [
      'Lý do kê và đúng phác đồ',
      'Tiền sử QT dài/rối loạn nhịp và thuốc tương tác',
      'Bệnh gan và dấu hiệu dị ứng',
    ],
    products: {
      VN: p(
        'Zithromax 500 mg',
        'Azithromycin dihydrate',
        '500 mg',
        'Viên nén bao phim',
        'rx',
        rx,
      ),
      IN: p('Azee 500', 'Azithromycin', '500 mg', 'Viên nén', 'rx', rx),
      US: p('Zithromax 500 mg', 'Azithromycin', '500 mg', 'Viên nén', 'rx', rx),
      CN: p('希舒美 500 mg', '阿奇霉素', '500 mg', 'Viên nén', 'rx', rx),
    },
  },
  {
    id: 'metformin',
    inn: 'Metformin',
    atc: 'A10BA02',
    purpose: 'Điều trị đái tháo đường type 2 theo đơn',
    safetyNote:
      'Thường gây khó chịu tiêu hóa; nguy cơ nhiễm acid lactic hiếm nhưng nghiêm trọng tăng khi suy thận hoặc một số tình trạng cấp.',
    excipientWatch:
      'Viên giải phóng tức thì và kéo dài không tương đương trực tiếp; lớp bao, màu và tá dược có thể khác.',
    pharmacistChecks: [
      'IR hay XR/ER và thời điểm uống',
      'Chức năng thận, bệnh cấp/mất nước',
      'Kế hoạch quanh thủ thuật có thuốc cản quang nếu có',
    ],
    products: {
      VN: p(
        'Glucophage 500 mg',
        'Metformin hydrochloride',
        '500 mg',
        'Viên giải phóng tức thì',
        'rx',
        rx,
      ),
      IN: p(
        'Glycomet 500',
        'Metformin hydrochloride',
        '500 mg',
        'Viên giải phóng tức thì',
        'rx',
        rx,
      ),
      US: p(
        'Metformin 500 mg',
        'Metformin hydrochloride',
        '500 mg',
        'Viên giải phóng tức thì',
        'rx',
        rx,
      ),
      CN: p(
        '格华止 500 mg',
        '盐酸二甲双胍',
        '500 mg',
        'Viên giải phóng tức thì',
        'rx',
        rx,
      ),
    },
  },
  {
    id: 'amlodipine',
    inn: 'Amlodipine',
    atc: 'C08CA01',
    purpose: 'Điều trị tăng huyết áp/đau thắt ngực theo đơn',
    safetyNote:
      'Có thể gây phù mắt cá, đỏ bừng, chóng mặt hoặc đánh trống ngực; không tự ngừng thuốc huyết áp khi đi du lịch.',
    excipientWatch:
      'Muối thường là amlodipine besylate nhưng nhãn có thể biểu thị theo amlodipine base; tá dược viên khác theo hãng.',
    pharmacistChecks: [
      'Hàm lượng tính theo amlodipine base',
      'Phù/chóng mặt và huyết áp hiện tại',
      'Đủ số ngày dùng và kế hoạch tái khám',
    ],
    products: {
      VN: p(
        'Norvasc 5 mg',
        'Amlodipine besylate',
        'Tương đương 5 mg amlodipine',
        'Viên nén',
        'rx',
        rx,
      ),
      IN: p(
        'Amlong 5',
        'Amlodipine besylate',
        'Tương đương 5 mg amlodipine',
        'Viên nén',
        'rx',
        rx,
      ),
      US: p(
        'Norvasc 5 mg',
        'Amlodipine besylate',
        'Tương đương 5 mg amlodipine',
        'Viên nén',
        'rx',
        rx,
      ),
      CN: p(
        '络活喜 5 mg',
        '苯磺酸氨氯地平',
        'Tương đương 5 mg amlodipine',
        'Viên nén',
        'rx',
        rx,
      ),
    },
  },
  {
    id: 'losartan',
    inn: 'Losartan',
    atc: 'C09CA01',
    purpose: 'Điều trị tăng huyết áp/bảo vệ thận theo chỉ định',
    safetyNote:
      'Có thể tăng kali hoặc ảnh hưởng chức năng thận; chống chỉ định trong thai kỳ vì có thể gây hại cho thai.',
    excipientWatch:
      'Màu bao phim, lactose và cách ghi muối kali có thể khác; sản phẩm phối hợp hydrochlorothiazide là thuốc khác.',
    pharmacistChecks: [
      'Có phải losartan đơn chất',
      'Thai kỳ/kế hoạch mang thai',
      'Kali, chức năng thận và các thuốc đang dùng',
    ],
    products: {
      VN: p(
        'Cozaar 50 mg',
        'Losartan potassium',
        '50 mg',
        'Viên nén bao phim',
        'rx',
        rx,
      ),
      IN: p('Losacar 50', 'Losartan potassium', '50 mg', 'Viên nén', 'rx', rx),
      US: p(
        'Cozaar 50 mg',
        'Losartan potassium',
        '50 mg',
        'Viên nén',
        'rx',
        rx,
      ),
      CN: p('科素亚 50 mg', '氯沙坦钾', '50 mg', 'Viên nén bao phim', 'rx', rx),
    },
  },
  {
    id: 'atorvastatin',
    inn: 'Atorvastatin',
    atc: 'C10AA05',
    purpose: 'Giảm cholesterol/nguy cơ tim mạch theo đơn',
    safetyNote:
      'Đau/yếu cơ bất thường hoặc nước tiểu sẫm cần được đánh giá; một số thuốc và bưởi có thể làm tăng phơi nhiễm.',
    excipientWatch:
      'Cách biểu thị atorvastatin calcium và tá dược như lactose/màu bao phim có thể khác theo nhà sản xuất.',
    pharmacistChecks: [
      'Đúng hàm lượng và hoạt chất đơn chất',
      'Đau cơ, bệnh gan và tương tác thuốc',
      'Thai kỳ/cho con bú theo hướng dẫn người kê đơn',
    ],
    products: {
      VN: p(
        'Lipitor 20 mg',
        'Atorvastatin calcium',
        'Tương đương 20 mg atorvastatin',
        'Viên nén bao phim',
        'rx',
        rx,
      ),
      IN: p(
        'Atorva 20',
        'Atorvastatin calcium',
        'Tương đương 20 mg atorvastatin',
        'Viên nén',
        'rx',
        rx,
      ),
      US: p(
        'Lipitor 20 mg',
        'Atorvastatin calcium',
        'Tương đương 20 mg atorvastatin',
        'Viên nén',
        'rx',
        rx,
      ),
      CN: p(
        '立普妥 20 mg',
        '阿托伐他汀钙',
        'Tương đương 20 mg atorvastatin',
        'Viên nén bao phim',
        'rx',
        rx,
      ),
    },
  },
  {
    id: 'levothyroxine',
    inn: 'Levothyroxine sodium',
    atc: 'H03AA01',
    purpose: 'Thay thế hormone tuyến giáp theo đơn',
    safetyNote:
      'Có khoảng liều cần theo dõi chặt; đổi sản phẩm có thể cần theo dõi TSH và triệu chứng, không tự tăng/giảm liều.',
    excipientWatch:
      'Màu theo hàm lượng, lactose/acacia và tá dược khác có thể thay đổi giữa nhãn hàng; cách uống cùng thức ăn/khoáng chất rất quan trọng.',
    pharmacistChecks: [
      'Đúng microgram — không nhầm mg',
      'Giữ nhất quán sản phẩm nếu có thể',
      'Khoảng cách với calcium, iron và thời điểm xét nghiệm TSH',
    ],
    products: {
      VN: p(
        'Euthyrox 50 microgram',
        'Levothyroxine sodium',
        '50 microgram',
        'Viên nén',
        'rx',
        rx,
      ),
      IN: p(
        'Thyronorm 50 microgram',
        'Thyroxine sodium',
        '50 microgram',
        'Viên nén',
        'rx',
        rx,
      ),
      US: p(
        'Synthroid 50 microgram',
        'Levothyroxine sodium',
        '50 microgram',
        'Viên nén',
        'rx',
        rx,
      ),
      CN: p(
        '优甲乐 50 microgram',
        '左甲状腺素钠',
        '50 microgram',
        'Viên nén',
        'rx',
        rx,
      ),
    },
  },
  {
    id: 'salbutamol',
    inn: 'Salbutamol (albuterol)',
    atc: 'R03AC02',
    purpose: 'Thuốc giãn phế quản dạng hít theo đơn',
    safetyNote:
      'Có thể gây run, tim nhanh hoặc hạ kali; cần đánh giá khẩn nếu khó thở không đáp ứng như kế hoạch điều trị.',
    excipientWatch:
      'Ống hít là sản phẩm thuốc–thiết bị: chất đẩy, van, số nhát, spacer và kỹ thuật dùng có thể khác.',
    pharmacistChecks: [
      'Liều ghi trên nhãn là metered hay delivered dose',
      'Thiết bị và kỹ thuật hít/spacer',
      'Tần suất dùng thuốc cắt cơn và kế hoạch hen',
    ],
    products: {
      VN: p(
        'Ventolin Evohaler',
        'Salbutamol sulfate',
        '100 microgram/nhát',
        'Bình xịt định liều',
        'rx',
        rx,
      ),
      IN: p(
        'Asthalin inhaler',
        'Salbutamol sulfate',
        '100 microgram/nhát',
        'Bình xịt định liều',
        'rx',
        rx,
      ),
      US: p(
        'Ventolin HFA',
        'Albuterol sulfate',
        '90 microgram/nhát delivered',
        'Bình xịt định liều',
        'rx',
        rx,
      ),
      CN: p(
        '万托林 Ventolin',
        '硫酸沙丁胺醇',
        '100 microgram/nhát',
        'Bình xịt định liều',
        'rx',
        rx,
      ),
    },
  },
  {
    id: 'insulin-glargine',
    inn: 'Insulin glargine',
    atc: 'A10AE04',
    purpose: 'Insulin nền tác dụng kéo dài',
    safetyNote:
      'Sai nồng độ, bút hoặc liều có thể gây hạ đường huyết nghiêm trọng; không chuyển đổi insulin chỉ dựa vào tên hoạt chất.',
    excipientWatch:
      'Dung dịch tiêm có hệ bảo quản và pH riêng; bút, kim tương thích, nồng độ và hướng dẫn bảo quản phải khớp.',
    pharmacistChecks: [
      'Đúng nồng độ U-100/U-300 và đúng bút',
      'Liều, thời điểm tiêm và kế hoạch khi đổi múi giờ',
      'Bảo quản lạnh và xử trí hạ đường huyết',
    ],
    products: {
      VN: p(
        'Lantus SoloStar',
        'Insulin glargine',
        '100 units/mL',
        'Bút tiêm nạp sẵn',
        'rx',
        rx,
      ),
      IN: p(
        'Basalog One',
        'Insulin glargine',
        '100 units/mL',
        'Bút tiêm nạp sẵn',
        'rx',
        rx,
      ),
      US: p(
        'Lantus SoloStar',
        'Insulin glargine',
        '100 units/mL',
        'Bút tiêm nạp sẵn',
        'rx',
        rx,
      ),
      CN: p(
        '来得时 SoloStar',
        '甘精胰岛素',
        '100 units/mL',
        'Bút tiêm nạp sẵn',
        'rx',
        rx,
      ),
    },
  },
  {
    id: 'ondansetron',
    inn: 'Ondansetron',
    atc: 'A04AA01',
    purpose: 'Phòng/giảm buồn nôn theo chỉ định',
    safetyNote:
      'Có thể gây táo bón, đau đầu và kéo dài QT; nguy cơ tăng với rối loạn điện giải hoặc thuốc ảnh hưởng nhịp tim.',
    excipientWatch:
      'Viên tan trong miệng có thể khác về aspartame, gelatin, mannitol và hương; không coi viên thường và viên tan là cùng dạng.',
    pharmacistChecks: [
      'Đúng dạng viên thường hay ODT',
      'QT dài, kali/magnesium thấp và thuốc tương tác',
      'Nguyên nhân nôn và dấu hiệu mất nước',
    ],
    products: {
      VN: p(
        'Zofran 4 mg',
        'Ondansetron hydrochloride',
        '4 mg',
        'Viên nén bao phim',
        'rx',
        rx,
      ),
      IN: p('Ondem 4', 'Ondansetron', '4 mg', 'Viên nén', 'rx', rx),
      US: p(
        'Zofran 4 mg',
        'Ondansetron hydrochloride',
        '4 mg',
        'Viên nén',
        'rx',
        rx,
      ),
      CN: p('枢丹 4 mg', '盐酸昂丹司琼', '4 mg', 'Viên nén', 'rx', rx),
    },
  },
];

export const METHODOLOGY_SOURCES = [
  {
    label: 'WHO — International Nonproprietary Names (INN)',
    url: 'https://www.who.int/teams/health-product-and-policy-standards/inn/',
  },
  {
    label: 'WHO — ATC/DDD classification',
    url: 'https://www.who.int/standards/classifications/other-classifications/the-anatomical-therapeutic-chemical-classification-system-with-defined-daily-doses',
  },
  {
    label: 'NLM — RxNorm normalized drug names',
    url: 'https://www.nlm.nih.gov/research/umls/rxnorm/overview.html',
  },
  {
    label: 'FDA — Orange Book therapeutic-equivalence definitions',
    url: 'https://www.fda.gov/drugs/development-approval-process-drugs/orange-book-preface',
  },
  {
    label: 'NLM — DailyMed current product labeling',
    url: 'https://dailymed.nlm.nih.gov/dailymed/',
  },
];

export function medicationSearchText(medication: MedicationExchange) {
  return [
    medication.inn,
    medication.atc,
    medication.purpose,
    ...Object.values(medication.products).flatMap((product) => [
      product.exampleName,
      product.localIngredient,
    ]),
  ]
    .join(' ')
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function pairReview(
  medication: MedicationExchange,
  from: CountryCode,
  to: CountryCode,
) {
  const source = medication.products[from];
  const target = medication.products[to];
  const sameStrength = source.strength === target.strength;
  const sameForm = source.form === target.form;
  const accessChanged = source.access !== target.access;
  return {
    sameStrength,
    sameForm,
    accessChanged,
    requiresExpertReview: true,
    summary:
      sameStrength && sameForm
        ? 'Cùng hoạt chất, hàm lượng và dạng mô tả — vẫn chưa phải xác nhận thay thế.'
        : 'Có sai khác về hàm lượng hoặc dạng dùng — không tự chuyển đổi.',
  };
}

export function labelForAccess(access: AccessClass, country: CountryCode) {
  if (access === 'rx') return 'Rx · Cần đơn';
  if (access === 'verify') return 'Cần xác minh';
  return country === 'IN' ? 'OTC* · Hỏi pharmacist' : 'OTC · Không kê đơn';
}

export function dailyMedSearchUrl(inn: string) {
  return `https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=${encodeURIComponent(inn.replace(/ \(.+\)$/, ''))}`;
}
