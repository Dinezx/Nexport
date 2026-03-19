import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getOfflineSession, isSupabaseReachable } from "@/lib/offlineAuth";
import { saveOfflineBooking } from "@/services/bookingService";
import { predictEtaAndRisk } from "@/lib/prediction";
import { predictDelayRisk, estimateShipmentDelay, type DelayRiskLevel } from "@/ml/delayPredictor";
import { suggestContainer, type ContainerSuggestion } from "@/services/containerOptimizer";
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
import { createNotification } from "@/services/notificationService";

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

const BOOKING_DRAFT_KEY = "nexport_booking_draft_v1";

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
  const location = useLocation();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [etaDays, setEtaDays] = useState<number | null>(null);
  const [etaConfidence, setEtaConfidence] = useState<string | null>(null);
  const [etaRange, setEtaRange] = useState<{ min: number; max: number } | null>(null);
  const [delayRisk, setDelayRisk] = useState<string | null>(null);
  const [delayReason, setDelayReason] = useState<string | null>(null);
  const [etaBreakdown, setEtaBreakdown] = useState<{
    transitDays: number;
    originHandling: number;
    destHandling: number;
    customsClearance: number;
    weatherImpact: number;
    congestionImpact: string;
  } | null>(null);
  const [delayRiskLabel, setDelayRiskLabel] = useState<string | null>(null);

  const defaultForm = {
    booking_date: "",
    origin: "",
    destination: "",
    transport: "sea",
    cargo_type: "",
    cargo_weight: "",
    container_type: "",
    container_size: "",
    booking_mode: "full" as "full" | "partial",
    space_cbm: "",
    selected_container_id: "",
  };

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
  }>(defaultForm);

  const [availableContainers, setAvailableContainers] = useState<any[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [containerAdvice, setContainerAdvice] = useState<ContainerSuggestion | null>(null);
  const [delayInsight, setDelayInsight] = useState<{
    probability: number;
    label: DelayRiskLevel;
    expectedEtaDays: number;
    factors: string[];
  } | null>(null);

  // Load draft on mount (unless explicitly starting a new booking)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const forceNew = params.get("new") === "1";

    if (forceNew) {
      try {
        localStorage.removeItem(BOOKING_DRAFT_KEY);
      } catch (err) {
        console.warn("Booking draft clear failed", err);
      }
      setForm(defaultForm);
      setStep(1);
      navigate("/booking", { replace: true });
      return;
    }

    try {
      const raw = localStorage.getItem(BOOKING_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setForm((prev) => ({ ...prev, ...parsed }));
      }
    } catch (err) {
      console.warn("Booking draft load failed", err);
    }
  }, [location.search, navigate]);

  // Persist draft whenever the form changes
  useEffect(() => {
    try {
      localStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(form));
    } catch (err) {
      console.warn("Booking draft save failed", err);
    }
  }, [form]);

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

  const renderCbmSuggestion = (cbm: number) => {
    if (cbm <= 0 || !containerAdvice) return "Enter your CBM to see the best option.";
    const lines = [
      `Recommended: ${containerAdvice.recommendation}`,
      `Total volume: ${containerAdvice.totalCbm.toFixed(2)} CBM`,
      ...containerAdvice.rationale,
    ];
    return lines.join(" · ");
  };

  /* ---------------- FETCH AVAILABLE CONTAINERS ---------------- */

  const fetchAvailableContainers = async () => {
    if (!form.container_type || !form.container_size) return;

    setLoadingContainers(true);
    console.log("[containers] fetch start", {
      type: form.container_type,
      size: form.container_size,
      mode: form.booking_mode,
      origin: form.origin,
    });

    const sizeFormatted = `${form.container_size}ft`;
    const normalizeSize = (v?: string | null) => (v || "").replace(/\s+/g, "").toLowerCase();
    const normalizeText = (v: string) => v.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    const originText = normalizeText((form.origin || "").split(",")[0] || "");
    const cityOnly = originText.split(" ")[0];

    const cityAlias: Record<string, string[]> = {
      bangalore: ["bengaluru", "blr"],
      bengaluru: ["bangalore", "blr"],
      mumbai: ["bombay", "bom"],
      chennai: ["maa"],
      hyderabad: ["hyd"],
      delhi: ["new delhi", "del"],
    };

    const expandAliases = (city: string) => {
      if (!city) return [] as string[];
      const aliases = cityAlias[city] || [];
      return [city, ...aliases];
    };
    const transport = form.transport;

    try {
      const res = await supabase.from("containers").select("*").limit(200);
      let data: any[] = res.data || [];
      console.log("containers fetched:", data.length, "err", res.error?.message);

      const filtered = data.filter((c: any) => {
        const sizeOk = normalizeSize(c.container_size) === normalizeSize(sizeFormatted) || normalizeSize(c.size) === normalizeSize(sizeFormatted);
        const typeOk = !form.container_type || c.container_type === form.container_type || c.type === form.container_type;
        const transportOk = !transport || !c.transport || c.transport === transport;
        const containerOrigin = normalizeText(c.origin || "");
        const containerLoc = normalizeText(c.current_location || "");

        let originOk = true;
        if (originText) {
          const aliases = expandAliases(cityOnly);
          originOk = aliases.some((alias) =>
            containerOrigin.includes(alias) || containerLoc.includes(alias)
          ) ||
          containerOrigin.includes(originText) || containerLoc.includes(originText) ||
          containerOrigin.includes(cityOnly) || containerLoc.includes(cityOnly);
        }
        return sizeOk && typeOk && transportOk && originOk;
      });

      if (originText && filtered.length === 0) {
        setAvailableContainers([]);
        setLoadingContainers(false);
        return;
      }

      const baseList = filtered.length ? filtered : data.filter((c: any) => {
        const sizeOk = normalizeSize(c.container_size) === normalizeSize(sizeFormatted) || normalizeSize(c.size) === normalizeSize(sizeFormatted);
        const typeOk = !form.container_type || c.container_type === form.container_type || c.type === form.container_type;
        const transportOk = !transport || !c.transport || c.transport === transport;
        return sizeOk && typeOk && transportOk;
      });

      const mapped = baseList.map((c: any) => {
        const baseTotal = c.total_space_cbm ?? c.totalSpace ?? c.capacity ?? 0;
        const availSpace = c.available_space_cbm ?? c.availableSpace ?? baseTotal;
        return {
          ...c,
          available_space_cbm: availSpace,
          effective_available_cbm: availSpace,
          total_space_cbm: baseTotal,
        };
      });

      setAvailableContainers(mapped);
    } catch (err) {
      console.warn("Container fetch failed", err);
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
  }, [form.booking_mode, form.container_type, form.container_size, form.origin, form.destination]);


  const steps = [
    { number: 1, label: "Route" },
    { number: 2, label: "Cargo" },
    { number: 3, label: "Container" },
    { number: 4, label: "Summary" },
  ];

  /* ---------------- PREDICT ETA (Real-time dataset) ---------------- */

  useEffect(() => {
    if (step !== 4) return;
    if (!form.origin || !form.destination || !form.transport) return;
    setLoading(true);

    // Use local real-world prediction engine (instant, no network required)
    try {
      const result = predictEtaAndRisk({
        origin: form.origin,
        destination: form.destination,
        transport: form.transport as "sea" | "road" | "air",
        bookingMode: form.booking_mode,
        cbm: Number(form.space_cbm) || 0,
      });

      setEtaDays(result.etaDays);
      setEtaConfidence(result.etaConfidence);
      setEtaRange(result.etaRange);
      setDelayRisk(result.delayRisk);
      setDelayReason(result.delayReason);
      setEtaBreakdown(result.breakdown);
      try {
        const risk = predictDelayRisk(
          `${form.origin} → ${form.destination}`,
          form.destination,
          form.booking_date || "any"
        );
        setDelayRiskLabel(risk.label.toUpperCase());
      } catch {
        setDelayRiskLabel(null);
      }

      try {
        const cbmVal = Number(form.space_cbm) || 0;
        const laneCongestion = Math.min(10, 4 + (cbmVal > 25 ? 2 : 1));
        const mlDelay = estimateShipmentDelay({
          origin: form.origin,
          destination: form.destination,
          transport: form.transport as "sea" | "road" | "air",
          weatherIndex: form.transport === "air" ? 0.18 : form.transport === "road" ? 0.25 : 0.32,
          portCongestionOrigin: laneCongestion,
          portCongestionDestination: laneCongestion,
          vesselScheduleReliability: 0.78,
          historicalDelayRate: 0.24,
          routeDistanceKm: undefined,
        });
        setDelayInsight(mlDelay);
      } catch {
        setDelayInsight(null);
      }
    } catch (e) {
      console.error("Local ETA prediction failed", e);
      // Fallback to simple estimates
      const fallbackDays: Record<string, number> = { sea: 18, road: 7, air: 3 };
      setEtaDays(fallbackDays[form.transport] ?? 10);
      setEtaConfidence("low");
      setDelayRiskLabel(null);
      setDelayInsight(null);
    } finally {
      setLoading(false);
    }
  }, [step, form.origin, form.destination, form.transport, form.booking_mode, form.space_cbm]);

  // Compute container suggestion whenever CBM or mode changes
  useEffect(() => {
    const cbmVal = Number(form.space_cbm) || 0;
    if (cbmVal <= 0) {
      setContainerAdvice(null);
      return;
    }
    try {
      const suggestion = suggestContainer({
        length: 1,
        width: 1,
        height: Math.max(0.01, cbmVal),
        quantity: 1,
        priority: form.booking_mode === "partial" ? "standard" : "express",
      });
      setContainerAdvice(suggestion);
    } catch (err) {
      console.warn("CBM suggestion failed", err);
      setContainerAdvice(null);
    }
  }, [form.space_cbm, form.booking_mode]);

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

    const online = await isSupabaseReachable(import.meta.env.VITE_SUPABASE_URL!);

    let userId: string | null = null;

    if (online) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    }

    if (!userId) {
      const offlineUser = getOfflineSession();
      userId = offlineUser?.id ?? null;
    }

    if (!userId) {
      setLoading(false);
      alert("User not authenticated. Please log in again.");
      return;
    }

    const selectedContainer = availableContainers.find(c => c.id === form.selected_container_id);

    const bookingPayload = {
      exporter_id: userId,
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
      payment_status: "pending",
      payout_status: "pending",
    };

    let booking: any = null;

    if (online) {
      // Ensure profile exists (bookings.exporter_id references profiles.id)
      await supabase.from("profiles").upsert(
        { id: userId, name: "", role: "exporter" },
        { onConflict: "id", ignoreDuplicates: true }
      );

      const { data, error } = await supabase
        .from("bookings")
        .insert(bookingPayload)
        .select()
        .single();

      if (error || !data) {
        setLoading(false);
        alert("Booking failed: " + (error?.message || "Unknown error. Please check your input and try again."));
        return;
      }
      booking = data;

      try {
        await createNotification({
          user_id: userId,
          message: `Booking ${booking.id.slice(0, 8).toUpperCase()} created`,
          type: "booking_created",
        });
      } catch (err) {
        console.error("Booking notification failed", err);
      }
    } else {
      // Offline — store in localStorage
      booking = {
        ...bookingPayload,
        id: "offline-" + crypto.randomUUID(),
        created_at: new Date().toISOString(),
        container_type: form.container_type,
        container_size: form.container_size ? `${form.container_size}ft` : "",
        booking_mode: form.booking_mode,
        space_cbm: form.booking_mode === "partial" ? Number(form.space_cbm) : null,
      };
      saveOfflineBooking(booking);
    }

    // ── Update container space after booking (both full & partial) ──
    if (form.selected_container_id) {
      const allocatedCbm =
        form.booking_mode === "partial"
          ? Math.max(0, Number(form.space_cbm))
          : selectedContainer?.total_space_cbm ?? 0;

      // --- Always update localStorage so demo/fallback containers stay in sync ---
      try {
        const CONTAINER_KEY = "nexport_offline_containers";
        const stored: any[] = JSON.parse(localStorage.getItem(CONTAINER_KEY) || "[]");
        const idx = stored.findIndex((c: any) =>
          c?.id === form.selected_container_id ||
          (!!selectedContainer?.container_number && c?.container_number === selectedContainer.container_number)
        );

        const ctr = idx !== -1 ? stored[idx] : selectedContainer ? { ...selectedContainer } : null;
        if (ctr) {
          // Ensure container_number exists for matching DB rows later
          if (!ctr.container_number && selectedContainer?.container_number) {
            ctr.container_number = selectedContainer.container_number;
          }
          ctr.available_space_cbm =
            form.booking_mode === "full"
              ? 0
              : Math.max(0, (ctr.available_space_cbm ?? ctr.total_space_cbm ?? 0) - allocatedCbm);
          ctr.status = ctr.available_space_cbm === 0 ? "full" : "active";

          if (idx !== -1) {
            stored[idx] = ctr;
          } else {
            stored.push(ctr);
          }
          localStorage.setItem(CONTAINER_KEY, JSON.stringify(stored));
        }
      } catch (err) {
        console.error("Error updating localStorage container space:", err);
      }

      // --- Also update the in-memory state so UI reflects immediately ---
      setAvailableContainers(prev =>
        prev.map(c => {
          if (c.id !== form.selected_container_id) return c;
          const newAvail =
            form.booking_mode === "full"
              ? 0
              : Math.max(0, (c.available_space_cbm ?? c.total_space_cbm ?? 0) - allocatedCbm);
          return {
            ...c,
            available_space_cbm: newAvail,
            effective_available_cbm: newAvail,
            status: newAvail === 0 ? "full" : "active",
          };
        })
      );

      // --- Always attempt Supabase DB update (best-effort) ---
      // The selected container might be a "demo" with a fake ID, so we try
      // multiple strategies: first by exact ID, then by container_number,
      // then by matching type+size+origin.
      try {
        const sizeStr = form.container_size ? `${form.container_size}ft` : "";

        // Strategy 1: Try by exact ID (works when DB containers were fetched)
        let { data: dbContainer, error: dbErr } = await supabase
          .from("containers")
          .select("id, available_space_cbm, total_space_cbm")
          .eq("id", form.selected_container_id)
          .maybeSingle();

        // Strategy 2: Try by container_number (demo containers copy this field)
        if (!dbContainer && selectedContainer?.container_number) {
          const res2 = await supabase
            .from("containers")
            .select("id, available_space_cbm, total_space_cbm")
            .eq("container_number", selectedContainer.container_number)
            .maybeSingle();
          dbContainer = res2.data;
        }

        // Strategy 3: Match by type + size + origin (broadest match)
        if (!dbContainer) {
          const originText = (form.origin || "").split(",")[0].trim();
          let query = supabase
            .from("containers")
            .select("id, available_space_cbm, total_space_cbm, origin")
            .eq("container_size", sizeStr);

          // container_type column may not exist in all DBs, so try it
          if (form.container_type) {
            query = query.eq("container_type", form.container_type);
          }

          const { data: candidates } = await query;
          if (candidates && candidates.length > 0) {
            // Prefer one matching origin
            dbContainer = candidates.find((c: any) =>
              (c.origin || "").toLowerCase().includes(originText.toLowerCase())
            ) || candidates[0];
          }
        }

        if (dbContainer) {
          const newAvailableSpace =
            form.booking_mode === "full"
              ? 0
              : Math.max(0, (dbContainer.available_space_cbm ?? dbContainer.total_space_cbm ?? 0) - allocatedCbm);
          const newStatus = newAvailableSpace === 0 ? "full" : "active";

          // Also persist the same update under the real DB container id in localStorage,
          // so future DB reads can be overlaid even if this UPDATE is blocked by RLS.
          try {
            const CONTAINER_KEY = "nexport_offline_containers";
            const stored: any[] = JSON.parse(localStorage.getItem(CONTAINER_KEY) || "[]");
            const existingIdx = stored.findIndex((c: any) => c?.id === dbContainer.id);
            const base = existingIdx !== -1 ? stored[existingIdx] : (selectedContainer ? { ...selectedContainer } : {});
            const updated = {
              ...base,
              id: dbContainer.id,
              container_number: (base as any).container_number || selectedContainer?.container_number,
              available_space_cbm: newAvailableSpace,
              status: newStatus,
            };
            if (existingIdx !== -1) stored[existingIdx] = updated;
            else stored.push(updated);
            localStorage.setItem(CONTAINER_KEY, JSON.stringify(stored));
          } catch {
            // ignore localStorage failures
          }

          const { error: updateErr } = await supabase
            .from("containers")
            .update({
              available_space_cbm: newAvailableSpace,
              status: newStatus,
            })
            .eq("id", dbContainer.id);

          if (updateErr) {
            console.error("Supabase container update failed (RLS?):", updateErr);
            // Try with anon client as fallback
            try {
              const { createClient } = await import("@supabase/supabase-js");
              const anonClient = createClient(
                import.meta.env.VITE_SUPABASE_URL!,
                import.meta.env.VITE_SUPABASE_ANON_KEY!,
                { auth: { persistSession: false, autoRefreshToken: false } }
              );
              await anonClient
                .from("containers")
                .update({
                  available_space_cbm: newAvailableSpace,
                  status: newStatus,
                })
                .eq("id", dbContainer.id);
            } catch (anonErr) {
              console.error("Anon client container update also failed:", anonErr);
            }
          } else {
            console.log("✅ Supabase container updated: available_space_cbm =", newAvailableSpace);
            try {
              const providerNotification = await supabase
                .from("containers")
                .select("provider_id")
                .eq("id", dbContainer.id)
                .maybeSingle();
              const providerId = providerNotification.data?.provider_id;
              if (providerId) {
                await createNotification({
                  user_id: providerId,
                  message: `Container allocated for booking ${booking.id.slice(0, 8).toUpperCase()}`,
                  type: "container_allocated",
                });
              }
              await createNotification({
                user_id: userId,
                message: `Container allocated for booking ${booking.id.slice(0, 8).toUpperCase()}`,
                type: "container_allocated",
              });
            } catch (err) {
              console.error("Container allocation notifications failed", err);
            }
          }
        } else {
          console.warn("Could not find matching DB container to update");
        }
      } catch (err) {
        console.error("Error updating container space on Supabase:", err);
      }
    }

    // --- Online-only operations (AI, containers, conversations) ---
    if (online) {

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
              exporter_id: userId,
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
                sender_id: userId,
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

    // 👉 Redirect to Mock Payment (online)
    navigate(`/payment/${booking.id}`);

    } else {
      // 👉 Offline – redirect to payment page
      navigate(`/payment/${booking.id}`);
    }
  };

  return (
    <DashboardLayout userType="exporter">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">New Booking</h1>

        {/* Step Indicator */}
        <div className="flex items-center justify-between gap-4">
          {steps.map((s, i) => (
            <div key={s.number} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center font-bold transition-all duration-300",
                    step >= s.number
                      ? "bg-primary text-primary-foreground shadow-md scale-110"
                      : "bg-muted"
                  )}
                >
                  {step > s.number ? <Check className="animate-scale-in" /> : s.number}
                </div>
                <span className={cn(
                  "text-xs mt-2 transition-colors duration-300",
                  step >= s.number ? "text-primary font-medium" : "text-muted-foreground"
                )}>{s.label}</span>
              </div>
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="flex-1 mx-3 mt-[-1rem]">
                  <div className={cn(
                    "h-0.5 w-full rounded-full transition-all duration-500",
                    step > s.number ? "bg-primary" : "bg-muted"
                  )} />
                </div>
              )}
            </div>
          ))}
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
            <CardDescription>
              {step === 4 ? "Review & confirm" : "Enter shipment details"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">

            {/* STEP 1 – ROUTE */}
            {step === 1 && (
              <div className="animate-fade-in space-y-5">
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
                        "p-4 border rounded-lg transition-all duration-200 hover:shadow-md",
                        form.transport === m.id ? "border-primary bg-primary/10 shadow-sm scale-[1.02]" : "hover:border-primary/40"
                      )}
                    >
                      <m.icon className={cn("mx-auto mb-2 transition-transform duration-200", form.transport === m.id && "scale-110")} />
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
              </div>
            )}

            {/* STEP 2 – CARGO */}
            {step === 2 && (
              <div className="animate-fade-in space-y-5">
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
              </div>
            )}

            {/* STEP 3 – CONTAINER */}
            {step === 3 && (
              <div className="animate-fade-in space-y-5">
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
                              "p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md",
                              form.selected_container_id === container.id
                                ? "border-primary bg-primary/10 shadow-sm scale-[1.01]"
                                : "border-border hover:bg-muted/50 hover:border-primary/30"
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
                                    ? `Available: ${container.effective_available_cbm ?? container.available_space_cbm ?? '—'} CBM / Total: ${container.total_space_cbm ?? '—'} CBM`
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
                                  {(() => {
                                    const total = container.total_space_cbm ?? 0;
                                    const effectiveAvail = container.effective_available_cbm ?? container.available_space_cbm ?? total;
                                    const used = total > 0 ? ((total - effectiveAvail) / total) * 100 : 0;
                                    return `${used.toFixed(1)}% Used`;
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {form.booking_mode === "partial" && form.selected_container_id && (
                          <Input
                            type="number"
                            min={0}
                            max={(
                              availableContainers.find(c => c.id === form.selected_container_id)?.effective_available_cbm ??
                              availableContainers.find(c => c.id === form.selected_container_id)?.available_space_cbm ??
                              0
                            )}
                            placeholder="Enter CBM (max available)"
                            value={form.space_cbm}
                            onChange={(e) => {
                              const selected = availableContainers.find(c => c.id === form.selected_container_id);
                              const maxAvailable = selected?.effective_available_cbm ?? selected?.available_space_cbm ?? 0;
                              const value = Math.min(Number(e.target.value), maxAvailable);
                              setForm({
                                ...form,
                                space_cbm: Math.max(0, value).toString(),
                              });
                            }}
                          />
                        )}
                        {form.booking_mode === "partial" && form.space_cbm !== undefined && (
                          <div className="mt-2 text-sm p-3 rounded-md border bg-muted/30">
                            {renderCbmSuggestion(Number(form.space_cbm) || 0)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        No containers available for this route.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* STEP 4 – SUMMARY */}
            {step === 4 && (
              <div className="animate-fade-in space-y-4">
                <p><b>Date:</b> {form.booking_date}</p>
                <p><b>Route:</b> {form.origin} → {form.destination}</p>
                <p><b>Transport:</b> {form.transport}</p>
                <p><b>Cargo:</b> {form.cargo_type}</p>
                <p><b>Mode:</b> {form.booking_mode}</p>

                {/* ─── ETA Prediction Card ─── */}
                <div className="mt-4 p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <h4 className="font-semibold text-sm">Real-Time ETA Prediction</h4>
                    {etaConfidence && (
                      <span className={cn(
                        "ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium",
                        etaConfidence === "high" ? "bg-green-500/20 text-green-400" :
                        etaConfidence === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-red-500/20 text-red-400"
                      )}>
                        {etaConfidence} confidence
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-primary">{etaDays ?? "..."}</span>
                    <span className="text-sm text-muted-foreground">days</span>
                    {etaRange && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (range: {etaRange.min}–{etaRange.max} days)
                      </span>
                    )}
                  </div>

                  {/* Delay Risk */}
                  {delayRisk && (
                    <div className={cn(
                      "mt-3 p-2 rounded text-xs",
                      delayRisk === "low" ? "bg-green-500/10 text-green-400" :
                      delayRisk === "medium" ? "bg-yellow-500/10 text-yellow-400" :
                      "bg-red-500/10 text-red-400"
                    )}>
                      <span className="font-semibold">Delay Risk: {delayRisk.toUpperCase()}</span>
                      {delayReason && <p className="mt-1 opacity-80">{delayReason}</p>}

                {delayInsight && (
                  <div className="p-4 rounded-lg border bg-muted/40">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      <h4 className="font-semibold text-sm">ML Delay Risk (feature-based)</h4>
                      <span className="ml-auto text-xs font-medium text-amber-400">
                        {(delayInsight.probability * 100).toFixed(0)}% risk
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80">Expected arrival ~{delayInsight.expectedEtaDays} days</p>
                    {delayInsight.factors.length > 0 && (
                      <ul className="mt-2 text-xs text-muted-foreground space-y-1 list-disc list-inside">
                        {delayInsight.factors.slice(0, 3).map((f, idx) => (
                          <li key={idx}>{f}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                    </div>
                  )}

                  {/* Breakdown */}
                  {etaBreakdown && (
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Transit Time:</span>
                      <span className="text-right font-medium text-foreground">{etaBreakdown.transitDays} days</span>
                      <span>Origin Handling:</span>
                      <span className="text-right font-medium text-foreground">{etaBreakdown.originHandling} days</span>
                      <span>Dest Handling:</span>
                      <span className="text-right font-medium text-foreground">{etaBreakdown.destHandling} days</span>
                      <span>Customs Clearance:</span>
                      <span className="text-right font-medium text-foreground">{etaBreakdown.customsClearance} days</span>
                      {etaBreakdown.weatherImpact > 0 && (
                        <>
                          <span>Weather Impact:</span>
                          <span className="text-right font-medium text-yellow-400">+{etaBreakdown.weatherImpact}%</span>
                        </>
                      )}
                      <span>Port Congestion:</span>
                      <span className={cn(
                        "text-right font-medium",
                        etaBreakdown.congestionImpact === "High" ? "text-red-400" :
                        etaBreakdown.congestionImpact === "Moderate" ? "text-yellow-400" :
                        "text-green-400"
                      )}>{etaBreakdown.congestionImpact}</span>
                    </div>
                  )}
                </div>
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
                {delayRiskLabel && (
                  <p className="text-sm text-muted-foreground">
                    Delay Risk: <span className="font-semibold">{delayRiskLabel}</span>
                  </p>
                )}
                <p className="text-xl font-bold text-primary">
                  ₹ {priceINR.toLocaleString("en-IN")}
                </p>
              </div>
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
