import { describe, it, expect } from "vitest";
import { applyFilters, FilterState } from "@/components/dashboard/Filters";
import { DrugApproval } from "@/data/fdaData";

// Mock data with various approval dates
const mockData: DrugApproval[] = [
  {
    approvalMonth: "2025-10",
    approvalDate: "2025-10-15",
    ndaBlaNumber: "NDA 000001",
    applicationNo: "000001",
    applicationType: "NDA",
    brandName: "DRUG-A",
    activeIngredient: "ingredient-a",
    sponsor: "Sponsor A",
    indicationFull: "Test indication",
    therapeuticArea: "Test Area",
    isOncology: false,
    isBiosimilar: false,
    isNovelDrug: true,
    isOrphanDrug: false,
    approvalType: "정규승인",
    notes: "Test",
  },
  {
    approvalMonth: "2025-11",
    approvalDate: "2025-11-20",
    ndaBlaNumber: "NDA 000002",
    applicationNo: "000002",
    applicationType: "NDA",
    brandName: "DRUG-B",
    activeIngredient: "ingredient-b",
    sponsor: "Sponsor B",
    indicationFull: "Test indication",
    therapeuticArea: "Test Area",
    isOncology: true,
    isBiosimilar: false,
    isNovelDrug: false,
    isOrphanDrug: true,
    approvalType: "정규승인",
    notes: "Test",
  },
  {
    approvalMonth: "2025-12",
    approvalDate: "2025-12-11",
    ndaBlaNumber: "NDA 000003",
    applicationNo: "000003",
    applicationType: "BLA",
    brandName: "DRUG-C",
    activeIngredient: "ingredient-c",
    sponsor: "Sponsor C",
    indicationFull: "Test indication",
    therapeuticArea: "항암제 - 림프종",
    isOncology: true,
    isBiosimilar: false,
    isNovelDrug: true,
    isOrphanDrug: false,
    approvalType: "정규승인",
    notes: "Test",
  },
  {
    approvalMonth: "2025-12",
    approvalDate: "2025-12-28",
    ndaBlaNumber: "NDA 000004",
    applicationNo: "000004",
    applicationType: "NDA",
    brandName: "DRUG-D",
    activeIngredient: "ingredient-d",
    sponsor: "Sponsor D",
    indicationFull: "Test indication",
    therapeuticArea: "Test Area",
    isOncology: false,
    isBiosimilar: true,
    isNovelDrug: false,
    isOrphanDrug: false,
    approvalType: "정규승인",
    notes: "Test",
  },
  {
    approvalMonth: "2026-01",
    approvalDate: "2026-01-15",
    ndaBlaNumber: "NDA 000005",
    applicationNo: "000005",
    applicationType: "NDA",
    brandName: "DRUG-E",
    activeIngredient: "ingredient-e",
    sponsor: "Sponsor E",
    indicationFull: "Test indication",
    therapeuticArea: "Test Area",
    isOncology: false,
    isBiosimilar: false,
    isNovelDrug: true,
    isOrphanDrug: true,
    approvalType: "정규승인",
    notes: "Test",
  },
  {
    approvalMonth: "2026-01",
    approvalDate: "2026-01-28",
    ndaBlaNumber: "NDA 000006",
    applicationNo: "000006",
    applicationType: "BLA",
    brandName: "DRUG-F",
    activeIngredient: "ingredient-f",
    sponsor: "Sponsor F",
    indicationFull: "Test indication",
    therapeuticArea: "Test Area",
    isOncology: true,
    isBiosimilar: false,
    isNovelDrug: false,
    isOrphanDrug: false,
    approvalType: "정규승인",
    notes: "Test - Latest",
  },
];

const defaultFilters: FilterState = {
  dateRange: "all",
  startDate: undefined,
  endDate: undefined,
  applicationType: "all",
  sponsor: "all",
  therapeuticArea: "all",
  isOncology: "all",
  isBiosimilar: "all",
  isNovelDrug: "all",
  isOrphanDrug: "all",
};

describe("applyFilters - Date Range Filters", () => {
  // Reference date should be 2026-01-28 (latest in mockData)
  
  it("1개월 필터: 최신 데이터(1/28) 기준 12/28 이후만 표시", () => {
    const filters: FilterState = { ...defaultFilters, dateRange: "1m" };
    const result = applyFilters(mockData, filters);
    
    // Should include: 2025-12-28, 2026-01-15, 2026-01-28
    // Should exclude: 2025-10-15, 2025-11-20, 2025-12-11
    expect(result.length).toBe(3);
    expect(result.map(d => d.approvalDate).sort()).toEqual([
      "2025-12-28",
      "2026-01-15",
      "2026-01-28",
    ]);
  });

  it("3개월 필터: 최신 데이터(1/28) 기준 10/28 이후만 표시", () => {
    const filters: FilterState = { ...defaultFilters, dateRange: "3m" };
    const result = applyFilters(mockData, filters);
    
    // Cutoff: 2025-10-28
    // Should include: 2025-11-20, 2025-12-11, 2025-12-28, 2026-01-15, 2026-01-28
    // Should exclude: 2025-10-15
    expect(result.length).toBe(5);
    expect(result.find(d => d.approvalDate === "2025-10-15")).toBeUndefined();
  });

  it("6개월 필터: 최신 데이터(1/28) 기준 7/28 이후만 표시", () => {
    const filters: FilterState = { ...defaultFilters, dateRange: "6m" };
    const result = applyFilters(mockData, filters);
    
    // Cutoff: 2025-07-28
    // All mock data is after 7/28/2025, so all 6 items should be included
    expect(result.length).toBe(6);
  });

  it("1년 필터: 최신 데이터(1/28) 기준 전년 1/28 이후만 표시", () => {
    const filters: FilterState = { ...defaultFilters, dateRange: "1y" };
    const result = applyFilters(mockData, filters);
    
    // Cutoff: 2025-01-28
    // All mock data is after 1/28/2025, so all 6 items should be included
    expect(result.length).toBe(6);
  });

  it("2년 필터: 최신 데이터(1/28) 기준 2년전 1/28 이후만 표시", () => {
    const filters: FilterState = { ...defaultFilters, dateRange: "2y" };
    const result = applyFilters(mockData, filters);
    
    // Cutoff: 2024-01-28
    // All mock data is after 1/28/2024, so all 6 items should be included
    expect(result.length).toBe(6);
  });

  it("전체 필터: 모든 데이터 표시", () => {
    const filters: FilterState = { ...defaultFilters, dateRange: "all" };
    const result = applyFilters(mockData, filters);
    
    expect(result.length).toBe(6);
  });
});

describe("applyFilters - Custom Date Range", () => {
  it("커스텀 날짜: 시작일~종료일 범위 내 데이터만 표시", () => {
    const filters: FilterState = {
      ...defaultFilters,
      dateRange: "custom",
      startDate: new Date(2025, 11, 1), // 2025-12-01
      endDate: new Date(2025, 11, 31),   // 2025-12-31
    };
    const result = applyFilters(mockData, filters);
    
    // Should include: 2025-12-11, 2025-12-28
    expect(result.length).toBe(2);
    expect(result.map(d => d.approvalDate).sort()).toEqual([
      "2025-12-11",
      "2025-12-28",
    ]);
  });

  it("커스텀 날짜: 시작일만 설정 시 시작일 이후 모든 데이터 표시", () => {
    const filters: FilterState = {
      ...defaultFilters,
      dateRange: "custom",
      startDate: new Date(2026, 0, 1), // 2026-01-01
      endDate: undefined,
    };
    const result = applyFilters(mockData, filters);
    
    // Should include: 2026-01-15, 2026-01-28
    expect(result.length).toBe(2);
  });

  it("커스텀 날짜: 종료일만 설정 시 종료일 이전 모든 데이터 표시", () => {
    const filters: FilterState = {
      ...defaultFilters,
      dateRange: "custom",
      startDate: undefined,
      endDate: new Date(2025, 10, 30), // 2025-11-30
    };
    const result = applyFilters(mockData, filters);
    
    // Should include: 2025-10-15, 2025-11-20
    expect(result.length).toBe(2);
  });
});
