import { useState, useCallback, useEffect } from "react";
import { DrugApproval } from "@/data/fdaData";
import { therapeuticAreaKrMap, dosageFormKrMap, routeKrMap } from "@/data/therapeuticAreaMap";

const STORAGE_KEY = "fda-pending-approvals";
const OPENFDA_BASE = "https://api.fda.gov/drug/drugsfda.json";

// openFDA API 응답 타입
interface OpenFdaSubmission {
  submission_type: string;
  submission_number: string;
  submission_status: string;
  submission_status_date: string;
  submission_class_code?: string;
  submission_class_code_description?: string;
  submission_property_type?: Array<{ code: string }>;
}

interface OpenFdaProduct {
  brand_name: string;
  active_ingredients?: Array<{ name: string; strength?: string }>;
  marketing_status?: string;
  dosage_form?: string;
  route?: string;
}

interface OpenFdaResult {
  application_number: string;
  sponsor_name: string;
  products?: OpenFdaProduct[];
  submissions?: OpenFdaSubmission[];
  openfda?: {
    pharm_class_epc?: string[];
    pharm_class_cs?: string[];
    pharm_class_moa?: string[];
    route?: string[];
    substance_name?: string[];
  };
}

// ============================================================
// 항암제 세부 암종 분류 키워드
// ============================================================
const ONCOLOGY_CANCER_KEYWORDS: Array<[string[], string]> = [
  [["myeloma", "multiple myeloma"], "Oncology - Multiple Myeloma"],
  [["lymphoma", "hodgkin", "non-hodgkin"], "Oncology - Lymphoma"],
  [["lung", "non-small cell lung", "nsclc", "small cell lung"], "Oncology - Lung Cancer"],
  [["breast"], "Oncology - Breast Cancer"],
  [["prostate"], "Oncology - Prostate Cancer"],
  [["gastric", "stomach"], "Oncology - Gastric Cancer"],
  [["hepatocellular", "liver", "hepatic"], "Oncology - Liver Cancer"],
  [["pancreatic", "pancreas"], "Oncology - Pancreatic Cancer"],
  [["colorectal", "colon", "rectal"], "Oncology - Colorectal Cancer"],
  [["renal", "kidney"], "Oncology - Renal Cancer"],
  [["bladder", "urothelial"], "Oncology - Bladder Cancer"],
  [["melanoma"], "Oncology - Melanoma"],
  [["leukemia", "cll", "aml", "all", "cml"], "Oncology - Leukemia"],
  [["thyroid"], "Oncology - Thyroid Cancer"],
  [["skin", "basal cell", "squamous cell", "cutaneous"], "Oncology - Skin Cancer"],
  [["bone metast"], "Oncology - Bone Metastasis"],
];

const ONCOLOGY_GENERAL_KEYWORDS = [
  "antineoplastic", "kinase inhibitor", "pd-1", "pd-l1",
  "her2", "egfr", "alk inhibitor", "bcr-abl", "braf",
  "mek", "btk inhibitor", "anti-cd", "checkpoint inhibitor",
  "tyrosine kinase", "car-t", "car t",
];

// ============================================================
// pharm_class 키워드 → 세부 치료영역 매핑
// ============================================================
const PHARM_CLASS_TO_AREA: Array<[string[], string]> = [
  // 정신건강의학과
  [["antipsychotic", "schizophrenia"], "Psychiatry - Schizophrenia"],
  [["antidepressant", "serotonin reuptake"], "Psychiatry - Depression"],
  // 신경과
  [["anticonvulsant", "antiepileptic"], "Neurology - Pain"],
  [["alzheimer", "cholinesterase"], "Neurology - Alzheimer's Disease"],
  [["multiple sclerosis"], "Neurology - Multiple Sclerosis"],
  [["myasthenia"], "Neurology - Myasthenia Gravis"],
  [["muscular dystrophy", "dystrophin"], "Neurology - Muscular Dystrophy"],
  [["parkinson", "dopamine agonist"], "Neurology - Parkinson's Disease"],
  [["migraine", "cgrp", "triptan"], "Neurology - Migraine"],
  [["epilep", "seizure"], "Neurology - Epilepsy"],
  // 소화기내과
  [["crohn", "inflammatory bowel"], "Gastroenterology - Crohn's Disease"],
  [["ulcerative colitis"], "Gastroenterology - Ulcerative Colitis"],
  [["hepat", "liver", "hcv", "hbv"], "Gastroenterology - Liver Disease"],
  [["proton pump", "antacid", "h2 receptor"], "Gastroenterology - Ulcerative Colitis"],
  // 감염내과
  [["antifungal"], "Infectious Disease - Antifungal"],
  [["antibacterial", "antibiotic", "antimicrobial"], "Infectious Disease - Antibacterial"],
  [["hiv", "antiretroviral", "protease inhibitor [hiv"], "Infectious Disease - HIV"],
  [["antiviral", "hepatitis"], "Infectious Disease - Antiviral"],
  [["antitubercular", "tuberculosis"], "Infectious Disease - Tuberculosis"],
  // 심장내과
  [["antihypertensive", "ace inhibitor", "angiotensin"], "Cardiology - Heart Failure"],
  [["antiarrhythmic"], "Cardiology - Arrhythmia"],
  [["hmg-coa", "statin", "cholesterol", "pcsk9"], "Cardiology - Hypercholesterolemia"],
  [["pulmonary arterial hypertension", "endothelin"], "Cardiology - Pulmonary Arterial Hypertension"],
  // 내분비내과
  [["antidiabetic", "insulin", "glp-1", "sglt2", "metformin"], "Endocrinology - Diabetes"],
  [["osteoporosis", "bisphosphonate", "denosumab"], "Endocrinology - Osteoporosis"],
  [["obesity", "weight", "anti-obesity"], "Endocrinology - Obesity"],
  // 호흡기내과
  [["bronchodilator", "beta-2 adrenergic"], "Pulmonology - Asthma"],
  [["pulmonary fibrosis", "antifibrotic"], "Pulmonology - Pulmonary Fibrosis"],
  // 안과
  [["ophthalmic", "intraocular pressure", "glaucoma"], "Ophthalmology - Glaucoma"],
  [["macular degeneration", "anti-vegf", "vegf inhibitor"], "Ophthalmology - Macular Degeneration"],
  // 류마티스
  [["anti-inflammatory", "tnf", "jak inhibitor", "janus kinase"], "Rheumatology - Autoimmune Disease"],
  [["immunosuppressant", "calcineurin"], "Immunology - GVHD"],
  // 피부과
  [["dermatolog", "atopic", "eczema"], "Dermatology - Atopic Dermatitis"],
  [["psoriasis", "interleukin-17", "il-17", "il-23"], "Dermatology - Psoriasis"],
  // 혈액내과
  [["anticoagulant", "thrombin", "factor xa"], "Hematology - PNH"],
  [["erythropoie", "anemia", "thalassemia"], "Hematology - Thalassemia"],
  [["hemophilia", "factor viii", "factor ix", "coagulation"], "Hematology - Hemophilia"],
  [["granulocyte", "neutropenia", "g-csf"], "Hematology - Neutropenia"],
  // 비뇨기과
  [["erectile dysfunction", "phosphodiesterase type 5"], "Urology - Erectile Dysfunction"],
  // 기타
  [["opioid antagonist", "naloxone", "naltrexone"], "Emergency Medicine - Opioid Overdose"],
  [["analgesic", "opioid agonist", "pain"], "Emergency Medicine - Analgesic"],
  [["contrast", "gadolinium", "barium"], "Radiology - Contrast Agent"],
  [["contraceptive", "progestin", "estrogen"], "OB/GYN - Contraception"],
  [["antihistamine", "histamine h1", "allergy"], "ENT - Allergy"],
  [["gene therapy", "viral vector", "aav"], "Immunology - Gene Therapy"],
  [["complement inhibitor", "c5"], "Hematology - PNH"],
  [["general anesthetic", "anesthetic"], "Emergency Medicine - Analgesic"],
  [["antiparasitic", "anthelmintic", "antiprotozoal"], "Infectious Disease - Antibacterial"],
];

// ============================================================
// 브랜드명/성분명 기반 폴백 분류 (pharm_class 없는 약물 대응)
// ============================================================
const BRAND_INGREDIENT_TO_AREA: Array<[string[], string]> = [
  // 항암제 (kinase inhibitors, immunotherapies 등)
  [["kisqali", "ribociclib"], "Oncology - Breast Cancer"],
  [["keytruda", "pembrolizumab"], "Oncology - Melanoma"],
  [["opdivo", "nivolumab"], "Oncology - Melanoma"],
  [["tecentriq", "atezolizumab"], "Oncology - Lung Cancer"],
  [["herceptin", "trastuzumab"], "Oncology - Breast Cancer"],
  [["avastin", "bevacizumab"], "Oncology - Colorectal Cancer"],
  [["rituxan", "rituximab"], "Oncology - Lymphoma"],
  [["imbruvica", "ibrutinib"], "Oncology - Leukemia"],
  [["revlimid", "lenalidomide"], "Oncology - Multiple Myeloma"],
  [["velcade", "bortezomib"], "Oncology - Multiple Myeloma"],
  [["stivarga", "regorafenib"], "Oncology - Colorectal Cancer"],
  [["lorbrena", "lorlatinib"], "Oncology - Lung Cancer"],
  [["truqap", "capivasertib"], "Oncology - Breast Cancer"],
  [["rybrevant", "amivantamab"], "Oncology - Lung Cancer"],
  [["adcetris", "brentuximab"], "Oncology - Lymphoma"],
  [["eligard", "leuprolide"], "Oncology - Prostate Cancer"],
  [["camcevi", "leuprolide"], "Oncology - Prostate Cancer"],
  [["nilotinib"], "Oncology - Leukemia"],
  [["tasigna"], "Oncology - Leukemia"],
  [["tagrisso", "osimertinib"], "Oncology - Lung Cancer"],
  [["lynparza", "olaparib"], "Oncology - Breast Cancer"],
  [["ibrance", "palbociclib"], "Oncology - Breast Cancer"],
  [["darzalex", "daratumumab"], "Oncology - Multiple Myeloma"],
  [["calquence", "acalabrutinib"], "Oncology - Leukemia"],
  [["enhertu", "trastuzumab deruxtecan"], "Oncology - Breast Cancer"],
  [["padcev", "enfortumab"], "Oncology - Bladder Cancer"],
  [["nplate", "romiplostim"], "Hematology - Neutropenia"],
  // 심장내과
  [["cardene", "nicardipine"], "Cardiology - Heart Failure"],
  [["nexterone", "amiodarone"], "Cardiology - Arrhythmia"],
  [["tracleer", "bosentan"], "Cardiology - Pulmonary Arterial Hypertension"],
  [["entresto", "sacubitril"], "Cardiology - Heart Failure"],
  [["eliquis", "apixaban"], "Cardiology - Arrhythmia"],
  [["xarelto", "rivaroxaban"], "Cardiology - Arrhythmia"],
  [["diltiazem"], "Cardiology - Arrhythmia"],
  [["vasopressin"], "Cardiology - Heart Failure"],
  // 류마티스/자가면역
  [["xeljanz", "tofacitinib"], "Rheumatology - Autoimmune Disease"],
  [["humira", "adalimumab"], "Rheumatology - Autoimmune Disease"],
  [["enbrel", "etanercept"], "Rheumatology - Autoimmune Disease"],
  [["otulfi", "ustekinumab"], "Dermatology - Psoriasis"],
  [["stelara", "ustekinumab"], "Dermatology - Psoriasis"],
  [["dupixent", "dupilumab"], "Dermatology - Atopic Dermatitis"],
  [["cosentyx", "secukinumab"], "Dermatology - Psoriasis"],
  [["skyrizi", "risankizumab"], "Dermatology - Psoriasis"],
  [["rinvoq", "upadacitinib"], "Rheumatology - Autoimmune Disease"],
  // 감염내과
  [["bactrim", "sulfamethoxazole", "trimethoprim", "septra", "sulfatrim"], "Infectious Disease - Antibacterial"],
  [["paxlovid", "nirmatrelvir"], "Infectious Disease - Antiviral"],
  [["epivir", "lamivudine"], "Infectious Disease - HIV"],
  [["truvada", "tenofovir", "emtricitabine"], "Infectious Disease - HIV"],
  // 신경과/정신과
  [["dayvigo", "lemborexant"], "Neurology - Pain"],
  [["sublocade", "buprenorphine"], "Emergency Medicine - Opioid Overdose"],
  [["suboxone", "buprenorphine"], "Emergency Medicine - Opioid Overdose"],
  [["zubsolv", "buprenorphine"], "Emergency Medicine - Opioid Overdose"],
  [["evrysdi", "risdiplam"], "Neurology - Muscular Dystrophy"],
  // 안과
  [["izervay", "avacincaptad"], "Ophthalmology - Macular Degeneration"],
  [["prolensa", "bromfenac"], "Ophthalmology - Ophthalmic Agent"],
  [["fml", "fluorometholone"], "Ophthalmology - Ophthalmic Agent"],
  [["enzeevu"], "Ophthalmology - Ophthalmic Agent"],
  // 내분비내과
  [["victoza", "liraglutide"], "Endocrinology - Diabetes"],
  [["ozempic", "semaglutide"], "Endocrinology - Diabetes"],
  [["jardiance", "empagliflozin"], "Endocrinology - Diabetes"],
  [["wegovy", "semaglutide"], "Endocrinology - Obesity"],
  // 소화기내과
  [["pepcid", "famotidine"], "Gastroenterology - Ulcerative Colitis"],
  [["nexium", "esomeprazole"], "Gastroenterology - Ulcerative Colitis"],
  // 기타
  [["brisdelle", "paroxetine"], "Psychiatry - Depression"],
  [["miudella", "copper"], "OB/GYN - Contraception"],
  [["ctexli", "ursodiol", "bile acid"], "Gastroenterology - Liver Disease"],
  [["gomekli", "somatrogon"], "Endocrinology - Metabolic Disease"],
  [["romvimza", "romosozumab"], "Endocrinology - Osteoporosis"],
  [["denosumab"], "Endocrinology - Osteoporosis"],
  [["ezallor", "rosuvastatin"], "Cardiology - Hypercholesterolemia"],
  [["atropine"], "Ophthalmology - Ophthalmic Agent"],
  // 바이오시밀러/신규 제품
  [["simlandi", "adalimumab"], "Rheumatology - Autoimmune Disease"],
  [["merilog", "insulin glargine"], "Endocrinology - Diabetes"],
  [["selarsdi", "ustekinumab"], "Dermatology - Psoriasis"],
  // 감염내과 (결핵 등)
  [["rifater", "rifampin", "isoniazid", "pyrazinamide"], "Infectious Disease - Tuberculosis"],
  [["nydrazid", "isoniazid"], "Infectious Disease - Tuberculosis"],
  [["rifadin", "rifampin"], "Infectious Disease - Tuberculosis"],
  // 기생충/열대감염
  [["moxidectin", "ivermectin"], "Infectious Disease - Antibacterial"],
  // 마취과
  [["ultane", "sevoflurane", "desflurane", "isoflurane"], "Emergency Medicine - Analgesic"],
];

// CBER 제품 감지 키워드
const CBER_KEYWORDS = [
  "gene therapy", "cell therapy", "car-t", "car t",
  "cellular therapy", "tissue", "viral vector", "aav",
  "lentiviral", "adeno-associated",
];

// ============================================================
// 치료영역 질환명 → 국문 질환 설명 매핑
// ============================================================
const DISEASE_DESCRIPTION_KR: Record<string, string> = {
  "Multiple Myeloma": "다발골수종",
  "Lymphoma": "림프종",
  "Lung Cancer": "폐암",
  "Breast Cancer": "유방암",
  "Prostate Cancer": "전립선암",
  "Bone Metastasis": "골전이",
  "Gastric Cancer": "위암",
  "Liver Cancer": "간암",
  "Pancreatic Cancer": "췌장암",
  "Colorectal Cancer": "대장암",
  "Renal Cancer": "신장암",
  "Bladder Cancer": "방광암",
  "Melanoma": "흑색종",
  "Leukemia": "백혈병",
  "Thyroid Cancer": "갑상선암",
  "Skin Cancer": "피부암",
  "Multiple Sclerosis": "다발성경화증",
  "Alzheimer's Disease": "알츠하이머병",
  "Parkinson's Disease": "파킨슨병",
  "Motion Sickness": "멀미",
  "Dystonia": "근긴장이상",
  "ALS": "근위축증 (ALS)",
  "Muscular Dystrophy": "근이영양증",
  "Rett Syndrome": "레트증후군",
  "Neuromyelitis Optica": "시신경척수염",
  "Myasthenia Gravis": "중증근무력증",
  "Pain": "통증",
  "Heart Failure": "심부전",
  "Arrhythmia": "부정맥",
  "Cardiomyopathy": "심근병증",
  "Hypercholesterolemia": "고콜레스테롤혈증",
  "Pulmonary Arterial Hypertension": "폐동맥고혈압",
  "Osteoporosis": "골다공증",
  "Diabetes": "당뇨병",
  "Metabolic Disease": "대사질환",
  "Obesity": "비만",
  "STI": "성매개감염병",
  "Tuberculosis": "결핵",
  "Fungal Infection": "진균 감염",
  "Antibacterial": "세균 감염",
  "Antifungal": "진균 감염",
  "Thalassemia": "지중해빈혈",
  "TA-TMA": "혈전성 미세혈관병증 (TA-TMA)",
  "PNH": "발작성 야간 혈색소뇨증 (PNH)",
  "Hemophilia": "혈우병",
  "Neutropenia": "호중구감소증",
  "Glaucoma": "녹내장",
  "Keratitis": "각막염",
  "Macular Degeneration": "황반변성",
  "Ophthalmic Agent": "안과 질환",
  "Gene Therapy": "유전자 치료",
  "GVHD": "이식편대숙주병 (GVHD)",
  "Asthma": "천식",
  "Angioedema": "혈관부종",
  "Pulmonary Fibrosis": "폐섬유증",
  "Depression": "우울증",
  "Schizophrenia": "조현병",
  "Antipsychotic": "정신질환",
  "Arthritis": "관절염",
  "Autoimmune Disease": "자가면역질환",
  "Psoriasis": "건선",
  "Atopic Dermatitis": "아토피피부염",
  "Erectile Dysfunction": "발기부전",
  "Contraception": "피임",
  "Allergy": "알레르기",
  "Contrast Agent": "영상 진단",
  "Vitamin": "영양 결핍",
  "IV Fluids": "수액 요법",
  "Opioid Overdose": "오피오이드 과량",
  "Analgesic": "통증",
  "Tumor": "종양",
  "Epilepsy": "간질",
  "Migraine": "편두통",
  "Antiviral": "바이러스 감염",
  "HIV": "HIV 감염",
  "Crohn's Disease": "크론병",
  "Ulcerative Colitis": "궤양성 대장염",
  "Liver Disease": "간질환",
  "Metabolic Diseases": "소아 대사질환",
  "Nutritional Deficiency": "영양 결핍",
};

// ============================================================
// 분류 함수들
// ============================================================
function getAllPharmClasses(result: OpenFdaResult): string[] {
  return [
    ...(result.openfda?.pharm_class_epc || []),
    ...(result.openfda?.pharm_class_cs || []),
    ...(result.openfda?.pharm_class_moa || []),
  ].map(c => c.toLowerCase());
}

function detectOncology(result: OpenFdaResult): boolean {
  const classes = getAllPharmClasses(result);
  // 1차: pharm_class 기반 감지
  if (classes.some(cls => ONCOLOGY_GENERAL_KEYWORDS.some(kw => cls.includes(kw)))) {
    return true;
  }
  // 2차: 브랜드명/성분명 기반 감지
  const brandName = (result.products?.[0]?.brand_name || "").toLowerCase();
  const ingredients = (result.products?.[0]?.active_ingredients || [])
    .map(ai => ai.name.toLowerCase());
  const searchTerms = [brandName, ...ingredients].join(" ");
  return BRAND_INGREDIENT_TO_AREA.some(
    ([keywords, area]) => area.startsWith("Oncology") && keywords.some(kw => searchTerms.includes(kw.toLowerCase()))
  );
}

function classifyOncologySubtype(result: OpenFdaResult): string {
  const classes = getAllPharmClasses(result);
  const allText = classes.join(" ");
  for (const [keywords, area] of ONCOLOGY_CANCER_KEYWORDS) {
    if (keywords.some(kw => allText.includes(kw))) return area;
  }
  return "Oncology";
}

function detectBiosimilar(result: OpenFdaResult, submission: OpenFdaSubmission): boolean {
  const hasBiosimilarProduct = result.products?.some(
    p => p.marketing_status?.toLowerCase().includes("biosimilar")
  ) || false;
  const hasBiosimilarClass = submission.submission_class_code_description
    ?.toLowerCase().includes("biosimilar") || false;
  return hasBiosimilarProduct || hasBiosimilarClass;
}

function detectNovelDrug(submission: OpenFdaSubmission): boolean {
  return submission.submission_class_code_description
    ?.includes("New Molecular Entity") || false;
}

function detectOrphan(submission: OpenFdaSubmission): boolean {
  return submission.submission_property_type?.some(
    p => p.code === "Orphan"
  ) || false;
}

function detectCberProduct(result: OpenFdaResult): boolean {
  const classes = getAllPharmClasses(result);
  return classes.some(cls => CBER_KEYWORDS.some(kw => cls.includes(kw)));
}

// ============================================================
// 치료영역 자동 분류 (세부 영역까지)
// ============================================================
function classifyTherapeuticAreaEn(result: OpenFdaResult, isOncology: boolean): string {
  // 1차: 브랜드명/성분명 기반 분류 (가장 정확 — pharm_class 넓은 매칭 오분류 방지)
  const brandName = (result.products?.[0]?.brand_name || "").toLowerCase();
  const ingredients = (result.products?.[0]?.active_ingredients || [])
    .map(ai => ai.name.toLowerCase());
  const substanceNames = (result.openfda?.substance_name || [])
    .map(n => n.toLowerCase());
  const searchTerms = [brandName, ...ingredients, ...substanceNames].join(" ");

  for (const [keywords, area] of BRAND_INGREDIENT_TO_AREA) {
    if (keywords.some(kw => searchTerms.includes(kw.toLowerCase()))) return area;
  }

  // 2차: 항암제 세부 분류 (pharm_class 기반)
  if (isOncology) return classifyOncologySubtype(result);

  // 3차: pharm_class 키워드 기반 분류
  const classes = getAllPharmClasses(result);
  const allText = classes.join(" ");

  if (allText.length > 0) {
    for (const [keywords, area] of PHARM_CLASS_TO_AREA) {
      if (keywords.some(kw => allText.includes(kw))) return area;
    }
  }

  return "Other";
}

// ============================================================
// 제형/투여경로 국문 변환
// ============================================================
function getDosageFormKr(product: OpenFdaProduct | undefined): string {
  if (!product?.dosage_form) return "";
  const form = product.dosage_form.toUpperCase().trim();
  // 매핑에 없으면 빈 문자열 (영문 폴백 방지)
  return dosageFormKrMap[form] || "";
}

function getRouteKr(product: OpenFdaProduct | undefined, result: OpenFdaResult): string {
  const route = product?.route?.toUpperCase().trim()
    || result.openfda?.route?.[0]?.toUpperCase().trim()
    || "";
  return routeKrMap[route] || "";
}

// ============================================================
// indicationFull 자동 생성 (기존 데이터 패턴과 동일)
// ============================================================
function buildIndicationFull(
  therapeuticAreaKr: string,
  isNovelDrug: boolean,
  isBiosimilar: boolean,
  product: OpenFdaProduct | undefined,
  result: OpenFdaResult,
  submission: OpenFdaSubmission,
): string {
  // 치료영역에서 질환명 추출
  const areaParts = therapeuticAreaKr.split(" - ");
  const specialty = areaParts[0]; // 진료과
  const disease = areaParts[1] || ""; // 질환명

  // 질환 설명 (영문 → 국문 변환)
  let diseaseDesc = disease || specialty;

  // DISEASE_DESCRIPTION_KR에서 국문 질환명 조회
  if (disease) {
    diseaseDesc = DISEASE_DESCRIPTION_KR[disease] || disease;
  }

  // "기타" 또는 미분류인 경우 투여경로 기반 국문 설명 생성
  if (diseaseDesc === "기타" || diseaseDesc.startsWith("[") || !disease) {
    const routeKr = getRouteKr(product, result);
    if (routeKr) {
      diseaseDesc = `${routeKr} 의약품`;
    } else {
      diseaseDesc = "전문의약품";
    }
  }

  // 제형
  const dosageForm = getDosageFormKr(product);
  const dosageFormSuffix = dosageForm ? ` (${dosageForm})` : "";

  // SUPPL인 경우
  if (submission.submission_type === "SUPPL") {
    const desc = submission.submission_class_code_description || "";
    if (desc.toLowerCase().includes("labeling")) {
      return `${diseaseDesc} 치료제 라벨링 변경${dosageFormSuffix}`;
    }
    if (desc.toLowerCase().includes("efficacy") || desc.toLowerCase().includes("new indication")) {
      return `${diseaseDesc} 치료를 위한 적응증 추가${dosageFormSuffix}`;
    }
    return `${diseaseDesc} 치료제 변경승인${dosageFormSuffix}`;
  }

  // 바이오시밀러
  if (isBiosimilar) {
    return `${diseaseDesc} 치료를 위한 바이오시밀러${dosageFormSuffix}`;
  }

  // 신약
  if (isNovelDrug) {
    return `${diseaseDesc} 치료를 위한 신약${dosageFormSuffix}`;
  }

  // 일반
  return `${diseaseDesc} 치료제${dosageFormSuffix}`;
}

// ============================================================
// supplementCategory 구성
// ============================================================
function buildSupplementCategory(submission: OpenFdaSubmission): string {
  const type = submission.submission_type;
  const num = submission.submission_number;
  const desc = submission.submission_class_code_description || "";

  if (type === "ORIG") {
    if (desc.includes("New Molecular Entity")) return `최초승인 (신물질)`;
    if (desc.toLowerCase().includes("new dosage form")) return `최초승인 (새 제형)`;
    if (desc.toLowerCase().includes("biosimilar")) return `BLA - 바이오시밀러`;
    return `최초승인`;
  }
  if (type === "SUPPL") {
    const descLower = desc.toLowerCase();
    if (descLower.includes("labeling")) return `변경승인 (SUPPL-${num}) - 라벨링`;
    if (descLower.includes("new indication")) return `변경승인 - 적응증 추가`;
    if (descLower.includes("efficacy")) return `변경승인 - 효능`;
    if (descLower.includes("manufacturing")) return `변경승인 - 제조`;
    if (descLower.includes("safety")) return `변경승인 - 안전성/라벨링`;
    if (descLower.includes("new dosage form")) return `변경승인 - 새 제형`;
    if (descLower.includes("biosimilar")) return `변경승인 - 바이오시밀러`;
    return `변경승인 (SUPPL-${num})`;
  }
  return `${type}-${num}`;
}

// ============================================================
// notes 자동 생성 (기존 데이터 패턴과 동일, [자동수집] 접두사 없음)
// ============================================================
function buildNotes(
  submission: OpenFdaSubmission,
  isNovelDrug: boolean,
  isBiosimilar: boolean,
  isOrphanDrug: boolean,
  isCberProduct: boolean,
): string {
  const parts: string[] = [];

  if (submission.submission_type === "SUPPL") {
    parts.push("변경승인");
    const desc = submission.submission_class_code_description || "";
    const descLower = desc.toLowerCase();
    if (descLower.includes("labeling")) parts.push("라벨링 변경");
    else if (descLower.includes("new indication")) parts.push("적응증 추가");
    else if (descLower.includes("efficacy")) parts.push("효능 추가");
    else if (descLower.includes("manufacturing")) parts.push("제조 변경");
    else if (descLower.includes("new dosage form")) parts.push("신규 제형");
    else if (descLower.includes("safety")) parts.push("안전성 라벨링");
  } else {
    if (isNovelDrug) parts.push("신약 (신물질)");
    if (isBiosimilar) parts.push("바이오시밀러");
    if (isOrphanDrug) parts.push("희귀의약품");
    if (isCberProduct) parts.push("생물학적 제제 (CBER)");
  }

  // submission_class_code_description에서 추가 정보
  const desc = submission.submission_class_code_description || "";
  if (desc && !desc.toLowerCase().includes("labeling") && submission.submission_type !== "SUPPL") {
    if (desc.includes("Type 3")) parts.push("새로운 제형");
  }

  return parts.join(". ");
}

// ============================================================
// activeIngredient 포맷 (FDA 원본 형식 유지)
// ============================================================
function formatActiveIngredient(product: OpenFdaProduct | undefined, result: OpenFdaResult): string {
  // openfda.substance_name 우선 사용 (FDA 공식 성분명, 접미사 포함 가능)
  if (result.openfda?.substance_name?.length) {
    return result.openfda.substance_name.map(n => n.toLowerCase()).join("; ");
  }
  // products.active_ingredients 폴백
  if (product?.active_ingredients?.length) {
    return product.active_ingredients.map(ai => ai.name.toLowerCase()).join("; ");
  }
  return "";
}

// ============================================================
// 메인 매핑 함수
// ============================================================
function mapFdaResult(result: OpenFdaResult, submission: OpenFdaSubmission): DrugApproval {
  const appNumRaw = result.application_number;
  const applicationType = appNumRaw.startsWith("BLA") ? "BLA" : "NDA";
  const applicationNo = appNumRaw.replace(/^(NDA|BLA|ANDA)/, "");

  const dateStr = submission.submission_status_date;
  const approvalDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  const approvalMonth = approvalDate.slice(0, 7);

  const primaryProduct = result.products?.[0];
  const brandName = primaryProduct?.brand_name || "UNKNOWN";
  const activeIngredient = formatActiveIngredient(primaryProduct, result);

  const isOncology = detectOncology(result);
  const isBiosimilar = detectBiosimilar(result, submission);
  const isNovelDrug = detectNovelDrug(submission);
  const isOrphanDrug = detectOrphan(submission);
  const isCberProduct = detectCberProduct(result);
  const supplementCategory = buildSupplementCategory(submission);

  // 치료영역 분류
  const therapeuticAreaEn = classifyTherapeuticAreaEn(result, isOncology);
  const therapeuticArea = therapeuticAreaKrMap[therapeuticAreaEn] || therapeuticAreaKrMap[therapeuticAreaEn.split(" - ")[0]] || "기타";

  // 국문 적응증 자동 생성
  const indicationFull = buildIndicationFull(
    therapeuticArea, isNovelDrug, isBiosimilar, primaryProduct, result, submission,
  );

  // notes 생성
  const notes = buildNotes(submission, isNovelDrug, isBiosimilar, isOrphanDrug, isCberProduct);

  // FDA URL (CBER 제품은 Drugs@FDA URL이 유효하지 않을 수 있음)
  const fdaUrl = `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${applicationNo}`;

  return {
    approvalMonth,
    approvalDate,
    ndaBlaNumber: `${applicationType} ${applicationNo}`,
    applicationNo,
    applicationType,
    brandName,
    activeIngredient,
    sponsor: result.sponsor_name || "",
    indicationFull,
    therapeuticArea,
    isOncology,
    isBiosimilar,
    isNovelDrug,
    isOrphanDrug,
    isCberProduct: isCberProduct || undefined,
    approvalType: "정규승인",
    supplementCategory,
    notes,
    fdaUrl,
  };
}

function formatDateForApi(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function makeDedupKey(drug: DrugApproval): string {
  return `${drug.applicationNo}-${drug.approvalDate}-${drug.supplementCategory || ""}`;
}

export interface PendingItem {
  id: string;
  drug: DrugApproval;
  fetchedAt: string;
}

export function useFdaFetch() {
  const [pendingItems, setPendingItems] = useState<PendingItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingItems));
  }, [pendingItems]);

  const fetchFdaData = useCallback(async (
    startDate: Date,
    endDate: Date,
    existingData: DrugApproval[],
  ) => {
    setIsFetching(true);
    setFetchError(null);

    try {
      const start = formatDateForApi(startDate);
      const end = formatDateForApi(endDate);
      const query = `submissions.submission_status_date:[${start}+TO+${end}]+AND+submissions.submission_status:"AP"`;
      const url = `${OPENFDA_BASE}?search=${query}&limit=100`;

      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) return { added: 0, skipped: 0 };
        throw new Error(`openFDA API 오류: ${response.status}`);
      }

      const json = await response.json();
      const results: OpenFdaResult[] = json.results || [];

      const existingKeys = new Set<string>();
      existingData.forEach(d => existingKeys.add(makeDedupKey(d)));
      pendingItems.forEach(p => existingKeys.add(makeDedupKey(p.drug)));

      const newItems: PendingItem[] = [];
      const startDateMs = startDate.getTime();
      const endDateMs = endDate.getTime();

      for (const result of results) {
        if (result.application_number.startsWith("ANDA")) continue;

        const approvedSubmissions = (result.submissions || []).filter(s => {
          if (s.submission_status !== "AP") return false;
          const dStr = s.submission_status_date;
          if (!dStr || dStr.length < 8) return false;
          const submDate = new Date(
            parseInt(dStr.slice(0, 4)),
            parseInt(dStr.slice(4, 6)) - 1,
            parseInt(dStr.slice(6, 8)),
          );
          return submDate.getTime() >= startDateMs && submDate.getTime() <= endDateMs;
        });

        for (const submission of approvedSubmissions) {
          const drug = mapFdaResult(result, submission);
          const key = makeDedupKey(drug);
          if (!existingKeys.has(key)) {
            existingKeys.add(key);
            newItems.push({
              id: `${key}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              drug,
              fetchedAt: new Date().toISOString(),
            });
          }
        }
      }

      setPendingItems(prev => [...prev, ...newItems]);
      return { added: newItems.length, skipped: results.length - newItems.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      setFetchError(message);
      return { added: 0, skipped: 0 };
    } finally {
      setIsFetching(false);
    }
  }, [pendingItems]);

  const updatePendingItem = useCallback((id: string, updatedDrug: DrugApproval) => {
    setPendingItems(prev =>
      prev.map(item => item.id === id ? { ...item, drug: updatedDrug } : item)
    );
  }, []);

  const removePendingItem = useCallback((id: string) => {
    setPendingItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const approveItem = useCallback((id: string): DrugApproval | null => {
    const item = pendingItems.find(p => p.id === id);
    if (!item) return null;
    setPendingItems(prev => prev.filter(p => p.id !== id));
    return item.drug;
  }, [pendingItems]);

  const approveAll = useCallback((): DrugApproval[] => {
    const drugs = pendingItems.map(p => p.drug);
    setPendingItems([]);
    return drugs;
  }, [pendingItems]);

  const clearAll = useCallback(() => {
    setPendingItems([]);
  }, []);

  return {
    pendingItems,
    isFetching,
    fetchError,
    fetchFdaData,
    updatePendingItem,
    removePendingItem,
    approveItem,
    approveAll,
    clearAll,
  };
}
