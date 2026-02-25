import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ValidationRequest {
  applicationNo: string;
  brandName: string;
  applicationType: string;
}

interface ValidationResult {
  applicationNo: string;
  brandName: string;
  isValid: boolean;
  fdaBrandNames: string[];
  fdaSponsor: string | null;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { items } = await req.json() as { items: ValidationRequest[] };

    if (!items || !Array.isArray(items)) {
      return new Response(
        JSON.stringify({ error: "Invalid request: items array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: ValidationResult[] = [];

    // Process items in batches to respect rate limits (40 req/min without API key)
    for (const item of items) {
      try {
        // Query FDA API by application number
        const fdaUrl = `https://api.fda.gov/drug/drugsfda.json?search=application_number:"${item.applicationType}${item.applicationNo}"&limit=1`;
        
        const response = await fetch(fdaUrl);
        
        if (!response.ok) {
          if (response.status === 404) {
            results.push({
              applicationNo: item.applicationNo,
              brandName: item.brandName,
              isValid: false,
              fdaBrandNames: [],
              fdaSponsor: null,
              error: "Application not found in FDA database",
            });
            continue;
          }
          throw new Error(`FDA API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
          results.push({
            applicationNo: item.applicationNo,
            brandName: item.brandName,
            isValid: false,
            fdaBrandNames: [],
            fdaSponsor: null,
            error: "No results from FDA",
          });
          continue;
        }

        const fdaRecord = data.results[0];
        const fdaBrandNames: string[] = [];
        
        // Extract all brand names from products
        if (fdaRecord.products && Array.isArray(fdaRecord.products)) {
          for (const product of fdaRecord.products) {
            if (product.brand_name && !fdaBrandNames.includes(product.brand_name)) {
              fdaBrandNames.push(product.brand_name);
            }
          }
        }

        // Check if our brand name matches any FDA brand name (case-insensitive)
        const normalizedBrandName = item.brandName.toUpperCase().replace(/[^A-Z0-9]/g, "");
        const isValid = fdaBrandNames.some(
          (name) => name.toUpperCase().replace(/[^A-Z0-9]/g, "") === normalizedBrandName
        );

        results.push({
          applicationNo: item.applicationNo,
          brandName: item.brandName,
          isValid,
          fdaBrandNames,
          fdaSponsor: fdaRecord.sponsor_name || null,
        });

        // Small delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (itemError) {
        console.error(`Error validating ${item.applicationNo}:`, itemError);
        results.push({
          applicationNo: item.applicationNo,
          brandName: item.brandName,
          isValid: false,
          fdaBrandNames: [],
          fdaSponsor: null,
          error: itemError instanceof Error ? itemError.message : "Unknown error",
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in validate-fda-data:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
