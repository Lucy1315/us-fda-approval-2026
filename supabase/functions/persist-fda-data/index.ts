import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DrugApproval {
  approvalMonth: string;
  approvalDate: string;
  ndaBlaNumber: string;
  applicationNo: string;
  applicationType: string;
  brandName: string;
  activeIngredient: string;
  sponsor: string;
  indicationFull: string;
  therapeuticArea: string;
  isOncology: boolean;
  isBiosimilar: boolean;
  isNovelDrug: boolean;
  isOrphanDrug: boolean;
  isCberProduct?: boolean;
  approvalType: string;
  supplementCategory?: string;
  notes: string;
  fdaUrl?: string;
}

interface SaveRequest {
  action: "save";
  data: DrugApproval[];
  notes?: string;
}

interface LoadRequest {
  action: "load";
}

type RequestBody = SaveRequest | LoadRequest;

// Build fingerprint for data (same logic as frontend)
function createDataFingerprint(data: DrugApproval[]): string {
  if (data.length === 0) return "empty";
  const first = data[0];
  const last = data[data.length - 1];
  const idsLen = data.reduce((acc, d) => acc + (d.applicationNo?.length || 0), 0);
  return `v2-${data.length}-${first?.applicationNo || ""}-${last?.applicationNo || ""}-${idsLen}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User auth from header
    const authHeader = req.headers.get("authorization") || "";
    const userToken = authHeader.replace("Bearer ", "");

    // Create client to extract user and check role
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });

    // Service client for admin operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = (await req.json()) as RequestBody;

    if (body.action === "load") {
      // Anyone can load published data - use public view to hide sensitive fields
      const { data: versionData } = await serviceClient
        .from("fda_data_versions_public")
        .select("id, version_number, updated_at")
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!versionData) {
        return new Response(
          JSON.stringify({ success: true, data: null, message: "No published data" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: rows } = await serviceClient
        .from("fda_data_rows")
        .select("payload")
        .eq("version_id", versionData.id);

      const drugs: DrugApproval[] = (rows || []).map((r) => r.payload as DrugApproval);

      return new Response(
        JSON.stringify({
          success: true,
          data: drugs,
          version: versionData.version_number,
          updatedAt: versionData.updated_at,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.action === "save") {
      // No authentication required - anyone can save data
      // Service client is used for all database operations

      const drugsToSave = body.data;
      const fingerprint = createDataFingerprint(drugsToSave);

      // Create new version (no user association - anonymous save)
      const { data: versionData, error: versionError } = await serviceClient
        .from("fda_data_versions")
        .insert({
          created_by: null,
          is_verified: true,
          is_published: true,
          data_fingerprint: fingerprint,
          notes: body.notes || null,
        })
        .select("id, version_number")
        .single();

      if (versionError) {
        console.error("Version insert error:", versionError);
        return new Response(
          JSON.stringify({ success: false, error: versionError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Insert rows in parallel chunks for better performance
      const CHUNK_SIZE = 100;
      const rowsToInsert = drugsToSave.map((d) => ({
        version_id: versionData.id,
        payload: d,
      }));

      const chunks: typeof rowsToInsert[] = [];
      for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
        chunks.push(rowsToInsert.slice(i, i + CHUNK_SIZE));
      }

      // Insert all chunks in parallel
      const insertResults = await Promise.all(
        chunks.map((chunk) => serviceClient.from("fda_data_rows").insert(chunk))
      );

      const rowsError = insertResults.find((r) => r.error)?.error;
      if (rowsError) {
        console.error("Rows insert error:", rowsError);
        return new Response(
          JSON.stringify({ success: false, error: rowsError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          version: versionData.version_number,
          message: `Saved ${drugsToSave.length} rows as version ${versionData.version_number}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("persist-fda-data error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
