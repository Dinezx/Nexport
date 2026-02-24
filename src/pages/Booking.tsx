import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Check,
  Truck,
  Ship,
  Plane,
  Loader2,
} from "lucide-react";

/* ---------------- CONSTANTS ---------------- */

const USD_TO_INR = 83;

/* ---------------- LOCATIONS ---------------- */

const LOCATIONS = [
  // Asia
  "Chennai Port, India",
  "Mumbai Port, India",
  "Tuticorin Port, India",
  "Cochin Port, India",
  "Kolkata Port, India",
  "Delhi ICD, India",
  "Bangalore ICD, India",
  "Hyderabad ICD, India",
  "Singapore Port, Singapore",
  "Dubai Port, UAE",
  "Jebel Ali Port, UAE",
  "Shanghai Port, China",
  "Shenzhen Port, China",
  "Hong Kong Port, Hong Kong",
  "Busan Port, South Korea",
  "Tokyo Port, Japan",
  "Kaohsiung Port, Taiwan",
  "Manila Port, Philippines",
  "Jakarta Port, Indonesia",
  "Bangkok Port, Thailand",
  "Ho Chi Minh City Port, Vietnam",
  "Colombo Port, Sri Lanka",
  "Karachi Port, Pakistan",
  "Dhaka Port, Bangladesh",
  "Yangon Port, Myanmar",
  "Kuala Lumpur Port, Malaysia",
  "Penang Port, Malaysia",
  "Surabaya Port, Indonesia",
  "Semarang Port, Indonesia",
  "Makassar Port, Indonesia",
  "Bandar Abbas Port, Iran",
  "Basra Port, Iraq",
  "Jeddah Port, Saudi Arabia",
  "Dammam Port, Saudi Arabia",
  "Salalah Port, Oman",
  "Muscat Port, Oman",
  "Abu Dhabi Port, UAE",
  "Fujairah Port, UAE",
  "Kuwait Port, Kuwait",
  "Bahrain Port, Bahrain",
  "Qatar Port, Qatar",
  "Doha Port, Qatar",
  "Riyadh ICD, Saudi Arabia",
  "Tehran Port, Iran",
  "Ashgabat Port, Turkmenistan",
  "Baku Port, Azerbaijan",
  "Tbilisi Port, Georgia",
  "Yerevan Port, Armenia",
  "Beirut Port, Lebanon",
  "Haifa Port, Israel",
  "Amman Port, Jordan",
  "Damascus Port, Syria",
  "Baghdad ICD, Iraq",
  "Ankara Port, Turkey",
  "Istanbul Port, Turkey",
  "Izmir Port, Turkey",
  "Alexandria Port, Egypt",
  "Port Said Port, Egypt",
  "Suez Port, Egypt",
  "Cairo ICD, Egypt",
  "Tripoli Port, Libya",
  "Benghazi Port, Libya",
  "Tunis Port, Tunisia",
  "Algiers Port, Algeria",
  "Oran Port, Algeria",
  "Casablanca Port, Morocco",
  "Tangier Port, Morocco",
  "Rabat Port, Morocco",
  "Cape Town Port, South Africa",
  "Durban Port, South Africa",
  "Johannesburg ICD, South Africa",
  "Maputo Port, Mozambique",
  "Beira Port, Mozambique",
  "Dar es Salaam Port, Tanzania",
  "Mombasa Port, Kenya",
  "Nairobi ICD, Kenya",
  "Djibouti Port, Djibouti",
  "Addis Ababa ICD, Ethiopia",
  "Khartoum Port, Sudan",
  "Port Sudan, Sudan",
  "Asmara Port, Eritrea",
  "Mogadishu Port, Somalia",
  "Hargeisa ICD, Somalia",
  "Lagos Port, Nigeria",
  "Port Harcourt Port, Nigeria",
  "Abuja ICD, Nigeria",
  "Accra Port, Ghana",
  "Tema Port, Ghana",
  "Takoradi Port, Ghana",
  "Cotonou Port, Benin",
  "Lome Port, Togo",
  "Ouagadougou ICD, Burkina Faso",
  "Bamako ICD, Mali",
  "Dakar Port, Senegal",
  "Nouakchott Port, Mauritania",
  "Conakry Port, Guinea",
  "Freetown Port, Sierra Leone",
  "Monrovia Port, Liberia",
  "Abidjan Port, Ivory Coast",
  "San Pedro Port, Ivory Coast",
  "Yamoussoukro ICD, Ivory Coast",
  "Brazzaville Port, Congo",
  "Pointe-Noire Port, Congo",
  "Kinshasa ICD, DRC",
  "Luanda Port, Angola",
  "Lobito Port, Angola",
  "Namibe Port, Angola",
  "Windhoek ICD, Namibia",
  "Walvis Bay Port, Namibia",
  "Lubango ICD, Angola",
  "Harare ICD, Zimbabwe",
  "Bulawayo ICD, Zimbabwe",
  "Lusaka ICD, Zambia",
  "Ndola ICD, Zambia",
  "Kitwe ICD, Zambia",
  "Lilongwe ICD, Malawi",
  "Blantyre ICD, Malawi",
  "Dodoma ICD, Tanzania",
  "Kigali ICD, Rwanda",
  "Bujumbura ICD, Burundi",
  "Kampala ICD, Uganda",
  "Entebbe ICD, Uganda",
  "Juba ICD, South Sudan",
  "Bangui ICD, Central African Republic",
  "N'Djamena ICD, Chad",
  "Niamey ICD, Niger",
  "Agadez ICD, Niger",
  "Bissau Port, Guinea-Bissau",
  "Praia Port, Cape Verde",
  "Sao Tome Port, Sao Tome and Principe",
  "Libreville Port, Gabon",
  "Port-Gentil Port, Gabon",
  "Malabo Port, Equatorial Guinea",
  "Douala Port, Cameroon",
  "Yaounde ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Yaounde ICD, Cameroon",
  "Garoua ICD, Cameroon",
  "Maroua ICD, Cameroon",
  "Ngaoundere ICD, Cameroon",
  "Bertoua ICD, Cameroon",
  "Ebolowa ICD, Cameroon",
  "Kribi Port, Cameroon",
  "Limbe Port, Cameroon",
  "Tiko Port, Cameroon",
  "Victoria Port, Cameroon",
  "Buea ICD, Cameroon",
  "Douala ICD, Cameroon",
  "Edea ICD, Cameroon",
  "Nkongsamba ICD, Cameroon",
  "Bafoussam ICD, Cameroon",
  "Dschang ICD, Cameroon",
  "Foumban ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Wum ICD, Cameroon",
  "Nkambe ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",
  "Njinikom ICD, Cameroon",
  "Kumbo ICD, Cameroon",
  "Oku ICD, Cameroon",
   // Example Airport Locations (for demonstration, as requested by user)
  "Mumbai International Airport, India",
  "Delhi International Airport, India",
  "Singapore Changi Airport, Singapore",
  "Dubai International Airport, UAE",
  "Shanghai Pudong Airport, China",
  "Los Angeles International Airport, USA",
  "London Heathrow Airport, UK",
  "Frankfurt Airport, Germany",
  "Tokyo Narita Airport, Japan",
  "Sydney Airport, Australia",
  "Toronto Pearson Airport, Canada",
  "Mexico City International Airport, Mexico",
  "Sao Paulo Guarulhos Airport, Brazil",
  "Jakiri ICD, Cameroon",
  "Fundong ICD, Cameroon",
  "Bali ICD, Cameroon",
  "Mbengwi ICD, Cameroon",
  "Ndop ICD, Cameroon",
  "Bamenda ICD, Cameroon",
  "Santa ICD, Cameroon",

  // Airports for Air Freight
  "Chennai International Airport, India",
  "Mumbai Chhatrapati Shivaji Maharaj International Airport, India",
  "Delhi Indira Gandhi International Airport, India",
  "Bangalore Kempegowda International Airport, India",
  "Hyderabad Rajiv Gandhi International Airport, India",
  "Kolkata Netaji Subhas Chandra Bose International Airport, India",
  "Singapore Changi Airport, Singapore",
  "Dubai International Airport, UAE",
  "Abu Dhabi International Airport, UAE",
  "Shanghai Pudong International Airport, China",
  "Beijing Capital International Airport, China",
  "Hong Kong International Airport, Hong Kong",
  "Tokyo Narita International Airport, Japan",
  "Osaka Kansai International Airport, Japan",
  "Seoul Incheon International Airport, South Korea",
  "Busan Gimhae International Airport, South Korea",
  "Taipei Taoyuan International Airport, Taiwan",
  "Kaohsiung International Airport, Taiwan",
  "Manila Ninoy Aquino International Airport, Philippines",
  "Jakarta Soekarno-Hatta International Airport, Indonesia",
  "Bangkok Suvarnabhumi Airport, Thailand",
  "Ho Chi Minh City International Airport, Vietnam",
  "Colombo Bandaranaike International Airport, Sri Lanka",
  "Karachi Jinnah International Airport, Pakistan",
  "Dhaka Hazrat Shahjalal International Airport, Bangladesh",
  "Yangon International Airport, Myanmar",
  "Kuala Lumpur International Airport, Malaysia",
  "Penang International Airport, Malaysia",
  "Tehran Imam Khomeini International Airport, Iran",
  "Jeddah King Abdulaziz International Airport, Saudi Arabia",
  "Riyadh King Khalid International Airport, Saudi Arabia",
  "Doha Hamad International Airport, Qatar",
  "Kuwait International Airport, Kuwait",
  "Bahrain International Airport, Bahrain",
  "Muscat International Airport, Oman",
  "Cape Town International Airport, South Africa",
  "Johannesburg O.R. Tambo International Airport, South Africa",
  "Durban King Shaka International Airport, South Africa",
  "Addis Ababa Bole International Airport, Ethiopia",
  "Nairobi Jomo Kenyatta International Airport, Kenya",
  "Lagos Murtala Muhammed International Airport, Nigeria",
  "Accra Kotoka International Airport, Ghana",
  "Dakar Blaise Diagne International Airport, Senegal",
  "Casablanca Mohammed V International Airport, Morocco",
  "London Heathrow Airport, UK",
  "Paris Charles de Gaulle Airport, France",
  "Frankfurt Airport, Germany",
  "Amsterdam Schiphol Airport, Netherlands",
  "Rome Fiumicino Airport, Italy",
  "Madrid Barajas Airport, Spain",
  "Barcelona El Prat Airport, Spain",
  "Munich Airport, Germany",
  "Zurich Airport, Switzerland",
  "Vienna International Airport, Austria",
  "Brussels Airport, Belgium",
  "Copenhagen Airport, Denmark",
  "Stockholm Arlanda Airport, Sweden",
  "Oslo Gardermoen Airport, Norway",
  "Helsinki Vantaa Airport, Finland",
  "Warsaw Chopin Airport, Poland",
  "Budapest Ferenc Liszt International Airport, Hungary",
  "Prague Václav Havel Airport, Czech Republic",
  "Athens International Airport, Greece",
  "Istanbul Airport, Turkey",
  "Moscow Sheremetyevo International Airport, Russia",
  "New York John F. Kennedy International Airport, USA",
  "Los Angeles International Airport, USA",
  "Chicago O'Hare International Airport, USA",
  "Houston George Bush Intercontinental Airport, USA",
  "Miami International Airport, USA",
  "San Francisco International Airport, USA",
  "Seattle-Tacoma International Airport, USA",
  "Boston Logan International Airport, USA",
  "Washington Dulles International Airport, USA",
  "Toronto Pearson International Airport, Canada",
  "Vancouver International Airport, Canada",
  "Montreal Pierre Elliott Trudeau International Airport, Canada",
  "Sydney Kingsford Smith Airport, Australia",
  "Melbourne Tullamarine Airport, Australia",
  "Brisbane Airport, Australia",
  "Perth Airport, Australia",
  "Auckland Airport, New Zealand",
  "São Paulo Guarulhos International Airport, Brazil",
  "Rio de Janeiro Galeão International Airport, Brazil",
  "Buenos Aires Ezeiza International Airport, Argentina",
  "Mexico City International Airport, Mexico",
  "Lima Jorge Chávez International Airport, Peru",
];

/* ---------------- STATIC DATA ---------------- */

const transportModes = [
  { id: "sea", label: "Sea Freight", icon: Ship },
  { id: "road", label: "Road Freight", icon: Truck },
  { id: "air", label: "Air Freight", icon: Plane },
];

const containerTypes = [
  { id: "normal", name: "Normal Container" },
  { id: "dry", name: "Dry Container" },
  { id: "reefer", name: "Reefer (Cooling)" },
];

const containerSizes = [
  { id: "20", label: "20 ft" },
  { id: "40", label: "40 ft" },
];

const cargoTypes = [
  "General Cargo",
  "Fragile",
  "Hazardous",
  "Perishable",
];

/* ---------------- PRICE LOGIC ---------------- */

const FCL_BASE_USD: Record<string, number> = {
  "20": 1200,
  "40": 1800,
};

const LCL_RATE_USD: Record<string, number> = {
  sea: 35,
  road: 50,
  air: 120,
};

function calculatePriceINR(form: any) {
  if (form.booking_mode === "full") {
    let usd = FCL_BASE_USD[form.container_size] || 0;
    if (form.container_type === "reefer") usd *= 1.3;
    return Math.round(usd * USD_TO_INR);
  }

  if (form.booking_mode === "partial") {
    const cbm = Math.max(0, Number(form.space_cbm || 0));
    const rate = LCL_RATE_USD[form.transport] || 0;
    return Math.round(cbm * rate * USD_TO_INR);
  }

  return 0;
}

/* ---------------- COMPONENT ---------------- */

export default function Booking() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [etaDays, setEtaDays] = useState<number | null>(null);
  const [etaConfidence, setEtaConfidence] = useState<string | null>(null);

  const [form, setForm] = useState<{
    booking_date: string;
    origin: string;
    destination: string;
    transport: string;
    cargo_type: string;
    cargo_weight: string;
    container_type: string;
    container_size: string;
    booking_mode: "full" | "partial";
    space_cbm: string;
    selected_container_id: string;
  }>({
    booking_date: "",
    origin: "",
    destination: "",
    transport: "sea",
    cargo_type: "",
    cargo_weight: "",
    container_type: "",
    container_size: "",
    booking_mode: "full",
    space_cbm: "",
    selected_container_id: "",
  });

  const [availableContainers, setAvailableContainers] = useState<any[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);

  const priceINR = calculatePriceINR(form);

  const getFilteredLocations = (mode: string) => {
    if (mode === "sea") {
      return LOCATIONS.filter(l => l.toLowerCase().includes("port"));
    }
    if (mode === "air") {
      return LOCATIONS.filter(l => l.toLowerCase().includes("airport"));
    }
    if (mode === "road") {
      return LOCATIONS.filter(l => l.toLowerCase().includes("icd"));
    }
    return LOCATIONS;
  };

  /* ---------------- FETCH AVAILABLE CONTAINERS ---------------- */

  const fetchAvailableContainers = async () => {
    if (!form.container_type || !form.container_size) return;

    setLoadingContainers(true);
    try {
      const sizeFormatted = `${form.container_size}ft`;

      // Fetch containers using current DB fields (type/size/current_location)
      const { data, error } = await supabase
        .from("containers")
        .select("*")
        .eq("type", form.container_type)
        .eq("size", sizeFormatted);

      if (error) {
        throw error;
      }

      // Fetch pending bookings to account for reserved (held) space
      const containerIds = (data || []).map((c: any) => c.id);
      let pendingReserved: Record<string, number> = {};
      if (containerIds.length > 0) {
        const { data: pendingBookings } = await supabase
          .from("bookings")
          .select("container_id, allocated_cbm, booking_mode")
          .in("container_id", containerIds)
          .eq("status", "pending_payment");

        if (pendingBookings) {
          for (const pb of pendingBookings) {
            if (!pb.container_id) continue;
            if (pb.booking_mode === "full") {
              // Full booking hold = entire container
              pendingReserved[pb.container_id] = Infinity;
            } else {
              pendingReserved[pb.container_id] = (pendingReserved[pb.container_id] || 0) + (pb.allocated_cbm || 0);
            }
          }
        }
      }

      // Calculate effective available space (minus pending holds)
      let filteredContainers = (data || []).map((c: any) => ({
        ...c,
        effective_available_cbm: Math.max(0, (c.available_space_cbm || 0) - (pendingReserved[c.id] || 0)),
      }));

      if (form.booking_mode === "partial") {
        filteredContainers = filteredContainers.filter((c: any) =>
          c.effective_available_cbm > 0
        );
      } else if (form.booking_mode === "full") {
        filteredContainers = filteredContainers.filter((c: any) =>
          typeof c.available_space_cbm === "number" && typeof c.total_space_cbm === "number"
            ? c.effective_available_cbm === c.total_space_cbm
            : true
        );
      }

      setAvailableContainers(filteredContainers);
    } catch (err) {
      setAvailableContainers([]);
    } finally {
      setLoadingContainers(false);
    }
  };

  useEffect(() => {
    if ((form.booking_mode === "partial" || form.booking_mode === "full") && form.container_type && form.container_size) {
      fetchAvailableContainers();
    } else {
      setAvailableContainers([]);
    }
  }, [form.booking_mode, form.container_type, form.container_size]);


  const steps = [
    { number: 1, label: "Route" },
    { number: 2, label: "Cargo" },
    { number: 3, label: "Container" },
    { number: 4, label: "Summary" },
  ];

  /* ---------------- FETCH ETA ---------------- */

  useEffect(() => {
    if (step !== 4) return;
    setLoading(true);
    // Fetch real ETA from AI function
    fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-eta`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin: form.origin,
          destination: form.destination,
          transport: form.transport,
          booking_mode: form.booking_mode,
          cbm: form.space_cbm,
        }),
      }
    )
      .then((r) => r.json().catch(() => null))
      .then((eta) => {
        if (eta && (eta.eta_days || eta.confidence)) {
          setEtaDays(eta.eta_days ?? null);
          setEtaConfidence(eta.confidence ?? null);
        } else {
          // Fallback to demo values if AI fails
          const demoEta = {
            sea: { days: 18, confidence: "high" },
            road: { days: 7, confidence: "medium" },
            air: { days: 3, confidence: "high" },
          };
          const fallback = demoEta[form.transport as keyof typeof demoEta] || { days: 10, confidence: "medium" };
          setEtaDays(fallback.days);
          setEtaConfidence(fallback.confidence);
        }
      })
      .catch(() => {
        // Fallback on error
        const demoEta = {
          sea: { days: 18, confidence: "high" },
          road: { days: 7, confidence: "medium" },
          air: { days: 3, confidence: "high" },
        };
        const fallback = demoEta[form.transport as keyof typeof demoEta] || { days: 10, confidence: "medium" };
        setEtaDays(fallback.days);
        setEtaConfidence(fallback.confidence);
      })
      .finally(() => setLoading(false));
  }, [step, form.origin, form.destination, form.transport, form.booking_mode, form.space_cbm]);

  /* ---------------- VALIDATION ---------------- */

  const canGoNext = () => {
    if (step === 1) {
      return form.transport && form.origin && form.destination && form.origin !== form.destination;
    }
    if (step === 2) {
      return form.cargo_type;
    }
    if (step === 3) {
      if (!form.container_type || !form.container_size) return false;
      if (form.booking_mode === "partial" && Number(form.space_cbm) <= 0)
        return false;
    }
    return true;
  };

  /* ---------------- CONFIRM → PAYMENT ---------------- */

  const handleConfirm = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const selectedContainer = availableContainers.find(c => c.id === form.selected_container_id);

    const { data: booking, error } = await supabase
      .from("bookings")
      .insert({
        exporter_id: user.id,
        booking_date: form.booking_date,
        origin: form.origin,
        destination: form.destination,
        transport_mode: form.transport,
        cargo_type: form.cargo_type,
        cargo_weight: form.cargo_weight
          ? Number(form.cargo_weight)
          : null,
        container_id: form.selected_container_id || null,
        container_number: selectedContainer?.container_number || null,
        allocated_cbm: form.booking_mode === "partial"
          ? Math.max(0, Number(form.space_cbm))
          : selectedContainer?.total_space_cbm || null,
        price: priceINR,
        status: "pending_payment",
      })
      .select()
      .single();

    if (error || !booking) {
      setLoading(false);
      alert("Booking failed: " + (error?.message || "Unknown error. Please check your input and try again."));
      return;
    }

    // Call AI ETA function (best-effort, non-blocking for the user)
    try {
      const r = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-eta`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            origin: form.origin,
            destination: form.destination,
            transport: form.transport,
            booking_mode: form.booking_mode,
            cbm: form.space_cbm,
          }),
        }
      );

      const eta = await r.json().catch(() => null);
      if (eta && (eta.eta_days || eta.confidence)) {
        // Update booking record with ETA
        await supabase
          .from("bookings")
          .update({
            eta_days: eta.eta_days ?? null,
            eta_confidence: eta.confidence ?? null,
          })
          .eq("id", booking.id);
      }
      // Always fetch the latest booking after ETA update
      const { data: updatedBooking } = await supabase
        .from("bookings")
        .select("eta_days, eta_confidence")
        .eq("id", booking.id)
        .single();
      setEtaDays(updatedBooking?.eta_days ?? null);
      setEtaConfidence(updatedBooking?.eta_confidence ?? null);
    } catch (e) {
      console.error("Failed to fetch ETA", e);
    }

    // Call AI Delay Risk function (best-effort, non-blocking for the user)
    try {
      const r = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-delay-risk`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            origin: form.origin,
            destination: form.destination,
            transport: form.transport,
            booking_mode: form.booking_mode,
            cbm: form.space_cbm,
          }),
        }
      );

      const risk = await r.json().catch(() => null);
      if (risk && (risk.risk || risk.reason)) {
        // Update booking record with delay risk
        await supabase
          .from("bookings")
          .update({
            delay_risk: risk.risk ?? null,
            delay_reason: risk.reason ?? null,
          })
          .eq("id", booking.id);
      }
    } catch (e) {
      console.error("Failed to fetch delay risk", e);
    }

    // Update container space after booking
    if (form.booking_mode === "partial" && form.selected_container_id) {
      try {
        const allocatedCbm = Math.max(0, Number(form.space_cbm));

        // First fetch current container data
        const { data: currentContainer, error: fetchError } = await supabase
          .from("containers")
          .select("available_space_cbm")
          .eq("id", form.selected_container_id)
          .single();

        if (fetchError || !currentContainer) {
          console.error("Failed to fetch container data:", fetchError);
          return;
        }

        const newAvailableSpace = Math.max(0, currentContainer.available_space_cbm - allocatedCbm);
        const newStatus = newAvailableSpace === 0 ? "full" : "active";

        // Update container with calculated values
        const { error: containerError } = await supabase
          .from("containers")
          .update({
            available_space_cbm: newAvailableSpace,
            status: newStatus
          })
          .eq("id", form.selected_container_id);

        if (containerError) {
          console.error("Failed to update container space:", containerError);
          // Don't block the booking flow, but log the error
        }
      } catch (err) {
        console.error("Error updating container space:", err);
      }
    }

    // 4️⃣ Create conversation and initial system message
    if (form.selected_container_id) {
      try {
        // Get container provider
        const { data: containerData, error: containerError } = await supabase
          .from("containers")
          .select("provider_id")
          .eq("id", form.selected_container_id)
          .single();

        if (containerError || !containerData) {
          console.error("Failed to fetch container provider:", containerError);
        } else {
          // Create conversation
          const { data: conversation, error: convError } = await supabase
            .from("conversations")
            .insert({
              booking_id: booking.id,
              container_id: form.selected_container_id,
              exporter_id: user.id,
              provider_id: containerData.provider_id,
            })
            .select()
            .single();

          if (convError || !conversation) {
            console.error("Failed to create conversation:", convError);
          } else {
            // Insert system message
            const { error: msgError } = await supabase
              .from("messages")
              .insert({
                conversation_id: conversation.id,
                sender_id: user.id,
                sender_role: "system",
                content: `Booking ${booking.id.slice(0, 8).toUpperCase()} has been created. You can coordinate shipment details here.`,
              });

            if (msgError) {
              console.error("Failed to create system message:", msgError);
            }
          }
        }
      } catch (err) {
        console.error("Error creating conversation:", err);
      }
    }

    // 👉 Redirect to Mock Payment
    navigate(`/payment/${booking.id}`);
  };

  return (
    <DashboardLayout userType="exporter">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">New Booking</h1>

        {/* Step Indicator */}
        <div className="flex justify-between">
          {steps.map((s) => (
            <div key={s.number} className="flex flex-col items-center">
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center font-bold",
                  step >= s.number
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {step > s.number ? <Check /> : s.number}
              </div>
              <span className="text-xs mt-2">{s.label}</span>
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
            <CardDescription>
              {step === 4 ? "Review & confirm" : "Enter shipment details"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">

            {/* STEP 1 – ROUTE */}
            {step === 1 && (
              <>
                <Label>Booking Date</Label>
                <Input
                  type="date"
                  value={form.booking_date}
                  onChange={e => setForm({ ...form, booking_date: e.target.value })}
                />

                <Label>Transport Mode</Label>
                <div className="grid grid-cols-3 gap-3">
                  {transportModes.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setForm({ ...form, transport: m.id })}
                      className={cn(
                        "p-4 border rounded-lg",
                        form.transport === m.id && "border-primary bg-primary/10"
                      )}
                    >
                      <m.icon className="mx-auto mb-2" />
                      {m.label}
                    </button>
                  ))}
                </div>

                {form.transport && (
                  <>
                    <div>
                      <Label>Origin</Label>
                      <Select
                        value={form.origin}
                        onValueChange={(value) => setForm({ ...form, origin: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select origin" />
                        </SelectTrigger>
                        <SelectContent>
                          {getFilteredLocations(form.transport).map((location) => (
                            <SelectItem key={location} value={location}>
                              {location}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Destination</Label>
                      <Select
                        value={form.destination}
                        onValueChange={(value) => setForm({ ...form, destination: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select destination" />
                        </SelectTrigger>
                        <SelectContent>
                          {getFilteredLocations(form.transport).map((location) => (
                            <SelectItem key={location} value={location}>
                              {location}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </>
            )}

            {/* STEP 2 – CARGO */}
            {step === 2 && (
              <>
                <Label>Cargo Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {cargoTypes.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm({ ...form, cargo_type: c })}
                      className={cn(
                        "p-4 border rounded-lg",
                        form.cargo_type === c && "border-primary bg-primary/10"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <Label>Estimated Weight (KG)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.cargo_weight}
                  onChange={(e) =>
                    setForm({ ...form, cargo_weight: e.target.value })
                  }
                />
              </>
            )}

            {/* STEP 3 – CONTAINER */}
            {step === 3 && (
              <>
                <Label>Booking Mode</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["full", "partial"] as const).map(m => (
                    <button
                      key={m}
                      onClick={() =>
                        setForm({ ...form, booking_mode: m, space_cbm: "" })
                      }
                      className={cn(
                        "p-4 border rounded-lg capitalize",
                        form.booking_mode === m && "border-primary bg-primary/10"
                      )}
                    >
                      {m === "full" ? "Full Container" : "Partial (CBM)"}
                    </button>
                  ))}
                </div>

                <Label>Container Type</Label>
                <div className="grid grid-cols-3 gap-3">
                  {containerTypes.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setForm({ ...form, container_type: c.id })}
                      className={cn(
                        "p-4 border rounded-lg",
                        form.container_type === c.id && "border-primary bg-primary/10"
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                <Label>Container Size</Label>
                <div className="grid grid-cols-2 gap-3">
                  {containerSizes.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setForm({ ...form, container_size: s.id })}
                      className={cn(
                        "p-4 border rounded-lg",
                        form.container_size === s.id && "border-primary bg-primary/10"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {(form.booking_mode === "partial" || form.booking_mode === "full") && (
                  <>
                    {loadingContainers ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="ml-2">Loading available containers...</span>
                      </div>
                    ) : availableContainers.length > 0 ? (
                      <div className="space-y-3">
                        <Label>Select Container</Label>
                        {availableContainers.map((container) => (
                          <div
                            key={container.id}
                            className={cn(
                              "p-4 border rounded-lg cursor-pointer transition-colors",
                              form.selected_container_id === container.id
                                ? "border-primary bg-primary/10"
                                : "border-border hover:bg-muted/50"
                            )}
                            onClick={() => setForm({ ...form, selected_container_id: container.id })}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium">
                                  {container.container_number} - {container.type || container.container_type} - {container.size || container.container_size}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {form.booking_mode === "partial"
                                    ? `Available: ${container.available_space_cbm ?? '—'} CBM / Total: ${container.total_space_cbm ?? '—'} CBM`
                                    : `Total Space: ${container.total_space_cbm ?? '—'} CBM`
                                  }
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Location: {container.current_location || container.origin || '—'}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Status: {container.status}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium">
                                  {form.booking_mode === "partial"
                                    ? `${((container.total_space_cbm - container.available_space_cbm) / container.total_space_cbm * 100).toFixed(1)}% Used`
                                    : "100% Available"
                                  }
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {form.booking_mode === "partial" && form.selected_container_id && (
                          <Input
                            type="number"
                            min={0}
                            max={availableContainers.find(c => c.id === form.selected_container_id)?.available_space_cbm || 0}
                            placeholder="Enter CBM (max available)"
                            value={form.space_cbm}
                            onChange={(e) => {
                              const maxAvailable = availableContainers.find(c => c.id === form.selected_container_id)?.available_space_cbm || 0;
                              const value = Math.min(Number(e.target.value), maxAvailable);
                              setForm({
                                ...form,
                                space_cbm: Math.max(0, value).toString(),
                              });
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        No containers available for this route.
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* STEP 4 – SUMMARY */}
            {step === 4 && (
              <>
                <p><b>Date:</b> {form.booking_date}</p>
                <p><b>Route:</b> {form.origin} → {form.destination}</p>
                <p>
                  <b>Estimated Delivery:</b> {etaDays ?? "Calculating..."} days
                  {etaConfidence && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({etaConfidence})
                    </span>
                  )}
                </p>
                <p><b>Transport:</b> {form.transport}</p>
                <p><b>Cargo:</b> {form.cargo_type}</p>
                <p><b>Mode:</b> {form.booking_mode}</p>
                {(() => {
                  const selectedContainer = availableContainers.find(c => c.id === form.selected_container_id);
                  switch (form.booking_mode) {
                    case "partial":
                      return (
                        <>
                          <p><b>Selected Container:</b> {selectedContainer?.container_number} - {selectedContainer?.type || selectedContainer?.container_type} - {selectedContainer?.size || selectedContainer?.container_size}</p>
                          <p><b>CBM:</b> {form.space_cbm}</p>
                        </>
                      );
                    case "full":
                      return (
                        <>
                          <p><b>Container:</b> {selectedContainer?.container_number} - {selectedContainer?.type || selectedContainer?.container_type} - {selectedContainer?.size || selectedContainer?.container_size}</p>
                        </>
                      );
                    default:
                      return null;
                  }
                })()}
                <p className="text-xl font-bold text-primary">
                  ₹ {priceINR.toLocaleString("en-IN")}
                </p>
              </>
            )}

            {/* NAV */}
            <div className="flex justify-between pt-4 border-t">
              {step > 1 ? (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              ) : <div />}

              {step < 4 ? (
                <Button onClick={() => canGoNext() && setStep(step + 1)} disabled={!canGoNext()}>
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleConfirm} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Proceed to Payment"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
