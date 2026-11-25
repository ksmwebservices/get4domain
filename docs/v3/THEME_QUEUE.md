# Theme Factory queue

Status values: QUEUED, IN PROGRESS, DONE, BLOCKED. The ledger (`THEME_FACTORY_LEDGER.md`) is the record of truth; on "continue" resume at the first item here that the ledger does not show as DONE or BLOCKED.

Items 1 to 14 are the owner's queue. Items 15 onwards are derived from the registration data (`C:\Get4Domain\theme-inbox\registration\get4domain-registration-v3\data.js`): family order as in that file, then the types of each family in file order, with each type listed once (a type that appears in two families stays with its first family) and with the types already covered by items 1 to 14 left out. The kind (handyman, professional, shop) is the registration file's own default for the family, with its per-type overrides. A "shop" type is built as a professional-style pack with a catalogue instead of a cart unless the ledger says otherwise.

Kit category = the closest of the kit's 41 category ids; the pack lists it in `theme.json` and the lint renders sample content for it.

| # | Type | Family | Kind | Kit category | Status |
|---|---|---|---|---|---|
| 1 | Real estate builder or project developer (big banner, slideshow, ongoing, upcoming and completed projects, a landing page per project) | Real Estate & Property | professional | real-estate-agent | DONE |
| 2 | Real estate agent and property portal (sale, lease, rent; a landing page per property; local area focus) | Real Estate & Property | professional | real-estate-agent | DONE |
| 3 | Contractor portfolio (building, civil, electrical) | Construction & Building | professional | mason-contractor | DONE |
| 4 | Interior designer | Interior Design & Home Decor | professional | interior-designer-architect | DONE |
| 5 | Carpenter | Home Services | handyman | carpenter | DONE |
| 6 | Consultant | Business & Management Consultants | professional | it-consultant | QUEUED |
| 7 | Auditor | Chartered Accountants & Taxation | professional | ca-tax-consultant | QUEUED |
| 8 | Advocate (civil) | Legal & Professional Services | professional | lawyer | QUEUED |
| 9 | Notary and public advocate | Legal & Professional Services | professional | lawyer | QUEUED |
| 10 | Arbitrator | Legal & Professional Services | professional | lawyer | QUEUED |
| 11 | Two-wheeler mechanic (handyman) | Automobiles & Two Wheelers | handyman | auto-mechanic | QUEUED |
| 12 | Garage (professional) | Automobiles & Two Wheelers | professional | auto-mechanic | QUEUED |
| 13 | Skin doctor | Healthcare & Medical | professional | doctor-clinic | QUEUED |
| 14 | Dental clinic | Healthcare & Medical | professional | dentist | QUEUED |
| 15 | AC Technicians | Home Services | handyman | (chosen when built) | QUEUED |
| 16 | Electricians | Home Services | handyman | (chosen when built) | QUEUED |
| 17 | Plumbers | Home Services | handyman | (chosen when built) | QUEUED |
| 18 | Painters | Home Services | handyman | (chosen when built) | QUEUED |
| 19 | Gas Stove Repair | Home Services | handyman | (chosen when built) | QUEUED |
| 20 | Home Appliance Repair | Home Services | handyman | (chosen when built) | QUEUED |
| 21 | RO & Water Purifier Service | Home Services | handyman | (chosen when built) | QUEUED |
| 22 | Handyman | Home Services | professional | (chosen when built) | QUEUED |
| 23 | House Cleaning | Home Services | handyman | (chosen when built) | QUEUED |
| 24 | Pest Control | Home Services | handyman | (chosen when built) | QUEUED |
| 25 | Waterproofing | Home Services | handyman | (chosen when built) | QUEUED |
| 26 | Locksmiths | Home Services | handyman | (chosen when built) | QUEUED |
| 27 | Packers & Movers | Home Services | professional | (chosen when built) | QUEUED |
| 28 | Clinics | Healthcare & Medical | professional | (chosen when built) | QUEUED |
| 29 | General Physicians | Healthcare & Medical | professional | (chosen when built) | QUEUED |
| 30 | Eye Specialists | Healthcare & Medical | professional | (chosen when built) | QUEUED |
| 31 | Physiotherapists | Healthcare & Medical | professional | (chosen when built) | QUEUED |
| 32 | Diagnostic Centres | Healthcare & Medical | professional | (chosen when built) | QUEUED |
| 33 | Pathology Labs | Healthcare & Medical | professional | (chosen when built) | QUEUED |
| 34 | Ambulance Services | Healthcare & Medical | handyman | (chosen when built) | QUEUED |
| 35 | Home Nursing Services | Healthcare & Medical | professional | (chosen when built) | QUEUED |
| 36 | Pharmacies | Healthcare & Medical | shop | (chosen when built) | QUEUED |
| 37 | Medical Stores | Healthcare & Medical | shop | (chosen when built) | QUEUED |
| 38 | Unisex Salons | Beauty, Salon & Personal Care | professional | (chosen when built) | QUEUED |
| 39 | Hair Stylists | Beauty, Salon & Personal Care | handyman | (chosen when built) | QUEUED |
| 40 | Bridal Makeup Artists | Beauty, Salon & Personal Care | handyman | (chosen when built) | QUEUED |
| 41 | Mehndi Artists | Beauty, Salon & Personal Care | handyman | (chosen when built) | QUEUED |
| 42 | Nail Studios | Beauty, Salon & Personal Care | handyman | (chosen when built) | QUEUED |
| 43 | Day Spas | Beauty, Salon & Personal Care | professional | (chosen when built) | QUEUED |
| 44 | Tattoo Studios | Beauty, Salon & Personal Care | handyman | (chosen when built) | QUEUED |
| 45 | Car Dealers | Automobiles & Two Wheelers | shop | (chosen when built) | QUEUED |
| 46 | Used Bike Dealers | Automobiles & Two Wheelers | shop | (chosen when built) | QUEUED |
| 47 | Car Washing | Automobiles & Two Wheelers | handyman | (chosen when built) | QUEUED |
| 48 | Tyre Dealers | Automobiles & Two Wheelers | shop | (chosen when built) | QUEUED |
| 49 | Driving Schools | Automobiles & Two Wheelers | professional | (chosen when built) | QUEUED |
| 50 | EV Charging Stations | Automobiles & Two Wheelers | professional | (chosen when built) | QUEUED |
| 51 | Play Schools | Education & Training | professional | (chosen when built) | QUEUED |
| 52 | Tuition Centres | Education & Training | professional | (chosen when built) | QUEUED |
| 53 | Home Tutors | Education & Training | handyman | (chosen when built) | QUEUED |
| 54 | Coaching Centres | Education & Training | professional | (chosen when built) | QUEUED |
| 55 | Spoken English Classes | Education & Training | handyman | (chosen when built) | QUEUED |
| 56 | Computer Training Institutes | Education & Training | professional | (chosen when built) | QUEUED |
| 57 | Music Classes | Education & Training | handyman | (chosen when built) | QUEUED |
| 58 | Dance Classes | Education & Training | handyman | (chosen when built) | QUEUED |
| 59 | Restaurants | Restaurants & Food | shop | (chosen when built) | QUEUED |
| 60 | Cafes | Restaurants & Food | shop | (chosen when built) | QUEUED |
| 61 | Bakeries | Restaurants & Food | shop | (chosen when built) | QUEUED |
| 62 | Sweet Shops | Restaurants & Food | shop | (chosen when built) | QUEUED |
| 63 | Cloud Kitchens | Restaurants & Food | shop | (chosen when built) | QUEUED |
| 64 | Catering Services | Restaurants & Food | professional | (chosen when built) | QUEUED |
| 65 | Tiffin Services | Restaurants & Food | professional | (chosen when built) | QUEUED |
| 66 | Home Cooks | Restaurants & Food | handyman | (chosen when built) | QUEUED |
| 67 | Supermarkets | Grocery & Daily Needs | shop | (chosen when built) | QUEUED |
| 68 | Grocery Stores | Grocery & Daily Needs | shop | (chosen when built) | QUEUED |
| 69 | Kirana Stores | Grocery & Daily Needs | shop | (chosen when built) | QUEUED |
| 70 | Fruits & Vegetable Shops | Grocery & Daily Needs | shop | (chosen when built) | QUEUED |
| 71 | Meat Shops | Grocery & Daily Needs | shop | (chosen when built) | QUEUED |
| 72 | Wholesale Grocery | Grocery & Daily Needs | shop | (chosen when built) | QUEUED |
| 73 | Water Can Suppliers | Grocery & Daily Needs | shop | (chosen when built) | QUEUED |
| 74 | Clothing Stores | Shopping & Retail | shop | (chosen when built) | QUEUED |
| 75 | Saree Shops | Shopping & Retail | shop | (chosen when built) | QUEUED |
| 76 | Boutique Shops | Shopping & Retail | shop | (chosen when built) | QUEUED |
| 77 | Footwear Shops | Shopping & Retail | shop | (chosen when built) | QUEUED |
| 78 | Jewellery Showrooms | Shopping & Retail | shop | (chosen when built) | QUEUED |
| 79 | Mobile Phone Dealers | Shopping & Retail | shop | (chosen when built) | QUEUED |
| 80 | Furniture Shops | Shopping & Retail | shop | (chosen when built) | QUEUED |
| 81 | Hardware Shops | Shopping & Retail | shop | (chosen when built) | QUEUED |
| 82 | Florists | Shopping & Retail | shop | (chosen when built) | QUEUED |
| 83 | Property Management | Real Estate & Property | professional | (chosen when built) | QUEUED |
| 84 | Home Loans | Real Estate & Property | professional | (chosen when built) | QUEUED |
| 85 | Architects | Construction & Building | professional | (chosen when built) | QUEUED |
| 86 | Structural Engineers | Construction & Building | professional | (chosen when built) | QUEUED |
| 87 | Steel Fabricators | Construction & Building | handyman | (chosen when built) | QUEUED |
| 88 | Cement Dealers | Construction & Building | shop | (chosen when built) | QUEUED |
| 89 | JCB Rental | Construction & Building | professional | (chosen when built) | QUEUED |
| 90 | Modular Kitchen Dealers | Interior Design & Home Decor | professional | (chosen when built) | QUEUED |
| 91 | False Ceiling Contractors | Interior Design & Home Decor | professional | (chosen when built) | QUEUED |
| 92 | Curtain Shops | Interior Design & Home Decor | shop | (chosen when built) | QUEUED |
| 93 | Furniture Repair | Interior Design & Home Decor | handyman | (chosen when built) | QUEUED |
| 94 | Vastu Consultants | Interior Design & Home Decor | handyman | (chosen when built) | QUEUED |
| 95 | Travel Agents | Travel & Tourism | professional | (chosen when built) | QUEUED |
| 96 | Tour Operators | Travel & Tourism | professional | (chosen when built) | QUEUED |
| 97 | Visa Consultants | Travel & Tourism | professional | (chosen when built) | QUEUED |
| 98 | Tourist Guides | Travel & Tourism | professional | (chosen when built) | QUEUED |
| 99 | Houseboat Booking | Travel & Tourism | professional | (chosen when built) | QUEUED |
| 100 | Transporters | Transportation & Logistics | professional | (chosen when built) | QUEUED |
| 101 | Courier Services | Transportation & Logistics | professional | (chosen when built) | QUEUED |
| 102 | Mini Truck Rental | Transportation & Logistics | professional | (chosen when built) | QUEUED |
| 103 | Logistics Companies | Transportation & Logistics | professional | (chosen when built) | QUEUED |
| 104 | Hotels | Hotels & Accommodation | professional | (chosen when built) | QUEUED |
| 105 | Resorts | Hotels & Accommodation | professional | (chosen when built) | QUEUED |
| 106 | Lodges | Hotels & Accommodation | professional | (chosen when built) | QUEUED |
| 107 | Guest Houses | Hotels & Accommodation | professional | (chosen when built) | QUEUED |
| 108 | Homestays | Hotels & Accommodation | professional | (chosen when built) | QUEUED |
| 109 | Service Apartments | Hotels & Accommodation | professional | (chosen when built) | QUEUED |
| 110 | Wedding Planners | Weddings & Events | professional | (chosen when built) | QUEUED |
| 111 | Wedding Decorators | Weddings & Events | handyman | (chosen when built) | QUEUED |
| 112 | Banquet Halls | Weddings & Events | professional | (chosen when built) | QUEUED |
| 113 | DJ Services | Weddings & Events | handyman | (chosen when built) | QUEUED |
| 114 | Tent Houses | Weddings & Events | shop | (chosen when built) | QUEUED |
| 115 | Photographers | Photography & Media | handyman | (chosen when built) | QUEUED |
| 116 | Videographers | Photography & Media | handyman | (chosen when built) | QUEUED |
| 117 | Video Production Companies | Photography & Media | professional | (chosen when built) | QUEUED |
| 118 | Graphic Designers | Photography & Media | handyman | (chosen when built) | QUEUED |
| 119 | Digital Printing | Photography & Media | shop | (chosen when built) | QUEUED |
| 120 | Digital Marketing Agencies | Photography & Media | professional | (chosen when built) | QUEUED |
| 121 | Loan Agents | Finance, Banking & Insurance | professional | (chosen when built) | QUEUED |
| 122 | Investment Consultants | Finance, Banking & Insurance | professional | (chosen when built) | QUEUED |
| 123 | Life Insurance Agents | Finance, Banking & Insurance | professional | (chosen when built) | QUEUED |
| 124 | Financial Advisors | Finance, Banking & Insurance | professional | (chosen when built) | QUEUED |
| 125 | Stock Brokers | Finance, Banking & Insurance | professional | (chosen when built) | QUEUED |
| 126 | GST Consultants | Chartered Accountants & Taxation | professional | (chosen when built) | QUEUED |
| 127 | Tax Return Filing | Chartered Accountants & Taxation | professional | (chosen when built) | QUEUED |
| 128 | Bookkeeping Services | Chartered Accountants & Taxation | professional | (chosen when built) | QUEUED |
| 129 | Company Incorporation | Chartered Accountants & Taxation | professional | (chosen when built) | QUEUED |
| 130 | Trademark Registration | Legal & Professional Services | professional | (chosen when built) | QUEUED |
| 131 | Company Secretaries | Legal & Professional Services | professional | (chosen when built) | QUEUED |
| 132 | HR Consultants | Business & Management Consultants | professional | (chosen when built) | QUEUED |
| 133 | Startup Consultants | Business & Management Consultants | professional | (chosen when built) | QUEUED |
| 134 | Virtual Assistants | Business & Management Consultants | professional | (chosen when built) | QUEUED |
| 135 | Data Entry Services | Business & Management Consultants | professional | (chosen when built) | QUEUED |
| 136 | Software Companies | IT, Software & Digital Services | professional | (chosen when built) | QUEUED |
| 137 | Web Developers | IT, Software & Digital Services | professional | (chosen when built) | QUEUED |
| 138 | Mobile App Developers | IT, Software & Digital Services | professional | (chosen when built) | QUEUED |
| 139 | Computer Repair | IT, Software & Digital Services | handyman | (chosen when built) | QUEUED |
| 140 | Web Hosting | IT, Software & Digital Services | professional | (chosen when built) | QUEUED |
| 141 | IT Support | IT, Software & Digital Services | handyman | (chosen when built) | QUEUED |
| 142 | Electronics Shops | Electronics & Electrical | shop | (chosen when built) | QUEUED |
| 143 | Home Appliance Dealers | Electronics & Electrical | shop | (chosen when built) | QUEUED |
| 144 | Gas Stove & Kitchen Appliance Dealers | Electronics & Electrical | shop | (chosen when built) | QUEUED |
| 145 | Electrical Shops | Electronics & Electrical | shop | (chosen when built) | QUEUED |
| 146 | CCTV Dealers | Electronics & Electrical | shop | (chosen when built) | QUEUED |
| 147 | Electronics Repair Centres | Electronics & Electrical | handyman | (chosen when built) | QUEUED |
| 148 | Manufacturers | Industrial & Manufacturing | shop | (chosen when built) | QUEUED |
| 149 | Machinery Manufacturers | Industrial & Manufacturing | shop | (chosen when built) | QUEUED |
| 150 | Fabrication Units | Industrial & Manufacturing | shop | (chosen when built) | QUEUED |
| 151 | Garment Manufacturers | Industrial & Manufacturing | shop | (chosen when built) | QUEUED |
| 152 | Industrial Automation | Industrial & Manufacturing | professional | (chosen when built) | QUEUED |
| 153 | Factory Maintenance | Industrial & Manufacturing | professional | (chosen when built) | QUEUED |
| 154 | Agricultural Consultants | Agriculture & Farming | professional | (chosen when built) | QUEUED |
| 155 | Fertilizer Dealers | Agriculture & Farming | shop | (chosen when built) | QUEUED |
| 156 | Seed Dealers | Agriculture & Farming | shop | (chosen when built) | QUEUED |
| 157 | Plant Nurseries | Agriculture & Farming | shop | (chosen when built) | QUEUED |
| 158 | Dairy Farms | Agriculture & Farming | professional | (chosen when built) | QUEUED |
| 159 | Irrigation Equipment Dealers | Agriculture & Farming | shop | (chosen when built) | QUEUED |
| 160 | Pet Grooming | Pets & Animal Services | handyman | (chosen when built) | QUEUED |
| 161 | Pet Training | Pets & Animal Services | handyman | (chosen when built) | QUEUED |
| 162 | Veterinary Clinics | Pets & Animal Services | professional | (chosen when built) | QUEUED |
| 163 | Pet Shops | Pets & Animal Services | shop | (chosen when built) | QUEUED |
| 164 | Pet Boarding | Pets & Animal Services | handyman | (chosen when built) | QUEUED |
| 165 | Security Agencies | Security & Safety | professional | (chosen when built) | QUEUED |
| 166 | CCTV Installation | Security & Safety | handyman | (chosen when built) | QUEUED |
| 167 | Fire Safety Services | Security & Safety | handyman | (chosen when built) | QUEUED |
| 168 | Fire Extinguisher Dealers | Security & Safety | shop | (chosen when built) | QUEUED |
| 169 | Mobile Phone Repair | Repairs & Technical Services | handyman | (chosen when built) | QUEUED |
| 170 | Laptop Repair | Repairs & Technical Services | handyman | (chosen when built) | QUEUED |
| 171 | Refrigerator Repair | Repairs & Technical Services | handyman | (chosen when built) | QUEUED |
| 172 | Watch Repair | Repairs & Technical Services | handyman | (chosen when built) | QUEUED |
| 173 | Sewing Machine Repair | Repairs & Technical Services | handyman | (chosen when built) | QUEUED |
| 174 | Pump Repair | Repairs & Technical Services | handyman | (chosen when built) | QUEUED |
| 175 | Car Rental | Rental & Hire Services | professional | (chosen when built) | QUEUED |
| 176 | Crane Rental | Rental & Hire Services | professional | (chosen when built) | QUEUED |
| 177 | Furniture Rental | Rental & Hire Services | professional | (chosen when built) | QUEUED |
| 178 | Sound System Rental | Rental & Hire Services | professional | (chosen when built) | QUEUED |
| 179 | Tent Rental | Rental & Hire Services | professional | (chosen when built) | QUEUED |
| 180 | Wheelchair Rental | Rental & Hire Services | professional | (chosen when built) | QUEUED |
| 181 | Cinema Halls | Entertainment & Recreation | professional | (chosen when built) | QUEUED |
| 182 | Gaming Zones | Entertainment & Recreation | professional | (chosen when built) | QUEUED |
| 183 | Recording Studios | Entertainment & Recreation | professional | (chosen when built) | QUEUED |
| 184 | Dance Studios | Entertainment & Recreation | professional | (chosen when built) | QUEUED |
| 185 | Event Venues | Entertainment & Recreation | professional | (chosen when built) | QUEUED |
| 186 | Gyms | Sports & Fitness | professional | (chosen when built) | QUEUED |
| 187 | Yoga Centres | Sports & Fitness | handyman | (chosen when built) | QUEUED |
| 188 | Personal Trainers | Sports & Fitness | handyman | (chosen when built) | QUEUED |
| 189 | Sports Academies | Sports & Fitness | professional | (chosen when built) | QUEUED |
| 190 | Fitness Equipment Dealers | Sports & Fitness | shop | (chosen when built) | QUEUED |
| 191 | Astrologers | Astrology & Spiritual Services | handyman | (chosen when built) | QUEUED |
| 192 | Meditation Centres | Astrology & Spiritual Services | professional | (chosen when built) | QUEUED |
| 193 | Purohits | Astrology & Spiritual Services | handyman | (chosen when built) | QUEUED |
| 194 | Pooja Item Stores | Astrology & Spiritual Services | shop | (chosen when built) | QUEUED |
| 195 | E-Sevai Centres | Government & Public Services | professional | (chosen when built) | QUEUED |
| 196 | CSC Centres | Government & Public Services | professional | (chosen when built) | QUEUED |
| 197 | Aadhaar Centres | Government & Public Services | professional | (chosen when built) | QUEUED |
| 198 | Government Scheme Consultants | Government & Public Services | professional | (chosen when built) | QUEUED |
| 199 | Recruitment Agencies | Recruitment & Job Services | professional | (chosen when built) | QUEUED |
| 200 | Overseas Job Consultants | Recruitment & Job Services | professional | (chosen when built) | QUEUED |
| 201 | Staffing Agencies | Recruitment & Job Services | professional | (chosen when built) | QUEUED |
| 202 | Career Counselling | Recruitment & Job Services | handyman | (chosen when built) | QUEUED |
| 203 | Resume Writing | Recruitment & Job Services | handyman | (chosen when built) | QUEUED |
| 204 | Housekeeping Services | Housekeeping & Facility Management | handyman | (chosen when built) | QUEUED |
| 205 | Office Cleaning | Housekeeping & Facility Management | handyman | (chosen when built) | QUEUED |
| 206 | Facility Management | Housekeeping & Facility Management | professional | (chosen when built) | QUEUED |
| 207 | Septic Tank Cleaning | Housekeeping & Facility Management | handyman | (chosen when built) | QUEUED |
| 208 | Pest Management | Housekeeping & Facility Management | handyman | (chosen when built) | QUEUED |
| 209 | Importers | Shipping, Export & Import | shop | (chosen when built) | QUEUED |
| 210 | Exporters | Shipping, Export & Import | shop | (chosen when built) | QUEUED |
| 211 | Freight Forwarders | Shipping, Export & Import | professional | (chosen when built) | QUEUED |
| 212 | Customs Clearing Agents | Shipping, Export & Import | professional | (chosen when built) | QUEUED |
| 213 | DGFT Consultants | Shipping, Export & Import | professional | (chosen when built) | QUEUED |
| 214 | Advertising Agencies | Advertising, Printing & Branding | professional | (chosen when built) | QUEUED |
| 215 | Branding Agencies | Advertising, Printing & Branding | professional | (chosen when built) | QUEUED |
| 216 | SEO Services | Advertising, Printing & Branding | professional | (chosen when built) | QUEUED |
| 217 | Flex Printing | Advertising, Printing & Branding | shop | (chosen when built) | QUEUED |
| 218 | Sign Board Manufacturers | Advertising, Printing & Branding | shop | (chosen when built) | QUEUED |
| 219 | Corporate Gifts | Advertising, Printing & Branding | shop | (chosen when built) | QUEUED |
| 220 | Tailors | Textiles, Clothing & Fashion | handyman | (chosen when built) | QUEUED |
| 221 | Embroidery Services | Textiles, Clothing & Fashion | handyman | (chosen when built) | QUEUED |
| 222 | Fashion Designers | Textiles, Clothing & Fashion | professional | (chosen when built) | QUEUED |
| 223 | Fabric Dealers | Textiles, Clothing & Fashion | shop | (chosen when built) | QUEUED |
| 224 | Silk Shops | Textiles, Clothing & Fashion | shop | (chosen when built) | QUEUED |
| 225 | Cosmetic Shops | Beauty, Health & Wellness Products | shop | (chosen when built) | QUEUED |
| 226 | Herbal Product Shops | Beauty, Health & Wellness Products | shop | (chosen when built) | QUEUED |
| 227 | Health Food Stores | Beauty, Health & Wellness Products | shop | (chosen when built) | QUEUED |
| 228 | Weight Loss Centres | Beauty, Health & Wellness Products | professional | (chosen when built) | QUEUED |
| 229 | Wellness Centres | Beauty, Health & Wellness Products | professional | (chosen when built) | QUEUED |
| 230 | Scrap Dealers | Waste Management & Environment | shop | (chosen when built) | QUEUED |
| 231 | E-Waste Recycling | Waste Management & Environment | handyman | (chosen when built) | QUEUED |
| 232 | Environmental Consultants | Waste Management & Environment | professional | (chosen when built) | QUEUED |
| 233 | Solar Energy Companies | Waste Management & Environment | professional | (chosen when built) | QUEUED |
| 234 | Water Treatment Plants | Waste Management & Environment | professional | (chosen when built) | QUEUED |
| 235 | Furniture Stores | Home, Garden & Outdoor | shop | (chosen when built) | QUEUED |
| 236 | Tiles Dealers | Home, Garden & Outdoor | shop | (chosen when built) | QUEUED |
| 237 | Hardware Stores | Home, Garden & Outdoor | shop | (chosen when built) | QUEUED |
| 238 | Gardening Services | Home, Garden & Outdoor | handyman | (chosen when built) | QUEUED |
| 239 | Landscape Designers | Home, Garden & Outdoor | professional | (chosen when built) | QUEUED |
| 240 | Swimming Pool Contractors | Home, Garden & Outdoor | professional | (chosen when built) | QUEUED |
| 241 | Translators | Professional & Personal Services | handyman | (chosen when built) | QUEUED |
| 242 | Typing Centres | Professional & Personal Services | handyman | (chosen when built) | QUEUED |
| 243 | DTP Centres | Professional & Personal Services | handyman | (chosen when built) | QUEUED |
| 244 | Laundry Services | Professional & Personal Services | handyman | (chosen when built) | QUEUED |
| 245 | Dry Cleaners | Professional & Personal Services | handyman | (chosen when built) | QUEUED |
| 246 | Tailoring Services | Professional & Personal Services | handyman | (chosen when built) | QUEUED |
| 247 | Photocopy Centres | Professional & Personal Services | handyman | (chosen when built) | QUEUED |
| 248 | Day Care Centres | Baby, Child & Family Services | professional | (chosen when built) | QUEUED |
| 249 | Nannies | Baby, Child & Family Services | handyman | (chosen when built) | QUEUED |
| 250 | Speech Therapy Centres | Baby, Child & Family Services | professional | (chosen when built) | QUEUED |
| 251 | Baby Product Shops | Baby, Child & Family Services | shop | (chosen when built) | QUEUED |
| 252 | Kids Activity Centres | Baby, Child & Family Services | professional | (chosen when built) | QUEUED |
| 253 | Medical Equipment Dealers | Medical & Home Care Equipment | shop | (chosen when built) | QUEUED |
| 254 | Oxygen Cylinder Suppliers | Medical & Home Care Equipment | shop | (chosen when built) | QUEUED |
| 255 | Wheelchair Dealers | Medical & Home Care Equipment | shop | (chosen when built) | QUEUED |
| 256 | Hearing Aid Dealers | Medical & Home Care Equipment | shop | (chosen when built) | QUEUED |
| 257 | Office Furniture Dealers | Industrial, Commercial & Office Services | shop | (chosen when built) | QUEUED |
| 258 | POS Machine Dealers | Industrial, Commercial & Office Services | shop | (chosen when built) | QUEUED |
| 259 | Packaging Material Suppliers | Industrial, Commercial & Office Services | shop | (chosen when built) | QUEUED |
| 260 | Commercial Kitchen Equipment | Industrial, Commercial & Office Services | shop | (chosen when built) | QUEUED |
| 261 | Cyber Cafes | Other Local Businesses | handyman | (chosen when built) | QUEUED |
| 262 | Xerox Shops | Other Local Businesses | shop | (chosen when built) | QUEUED |
| 263 | Ticket Booking Agents | Other Local Businesses | handyman | (chosen when built) | QUEUED |
| 264 | Miscellaneous Local Services | Other Local Businesses | handyman | (chosen when built) | QUEUED |
