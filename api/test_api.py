
# Run this to verify your setup: python test_ai_setup.py

import sys
print("🔍 Debugging AI Setup...\n")

# Test 1: Check imports
print("1️⃣ Testing imports...")
try:
    from app.api.ai_system_instructions import VIBECHECK_SYSTEM_INSTRUCTIONS
    print("   ✅ ai_system_instructions imported successfully")
    print(f"   📝 Instructions length: {len(VIBECHECK_SYSTEM_INSTRUCTIONS)} chars")
except ImportError as e:
    print(f"   ❌ Failed to import ai_system_instructions: {e}")
    sys.exit(1)

try:
    from app.api.ai_tools import get_events_tool, get_events_from_db
    print("   ✅ ai_tools imported successfully")
except ImportError as e:
    print(f"   ❌ Failed to import ai_tools: {e}")
    sys.exit(1)

try:
    from app.schemas import AIQueryRequest, ConversationMessage
    print("   ✅ schemas imported successfully")
except ImportError as e:
    print(f"   ❌ Failed to import schemas: {e}")
    sys.exit(1)

# Test 2: Check Gemini API key
print("\n2️⃣ Testing Gemini configuration...")
try:
    from app.core.config import settings
    if not settings.GEMINI_API_KEY:
        print("   ❌ GEMINI_API_KEY is not set!")
        sys.exit(1)
    print(f"   ✅ GEMINI_API_KEY is set (starts with: {settings.GEMINI_API_KEY[:10]}...)")
except Exception as e:
    print(f"   ❌ Failed to load settings: {e}")
    sys.exit(1)

# Test 3: Try initializing Gemini
print("\n3️⃣ Testing Gemini initialization...")
try:
    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)
    
    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash-exp",
        tools=[{"function_declarations": [get_events_tool]}],
        system_instruction=VIBECHECK_SYSTEM_INSTRUCTIONS,
    )
    print("   ✅ Gemini model initialized successfully")
    
    # Test a simple message
    print("\n4️⃣ Testing simple chat...")
    chat = model.start_chat(history=[])
    response = chat.send_message("Say 'test successful' if you can hear me")
    print(f"   ✅ Gemini responded: {response.text[:100]}...")
    
except Exception as e:
    print(f"   ❌ Failed to initialize Gemini: {e}")
    print(f"   Error type: {type(e).__name__}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 4: Test schema validation
print("\n5️⃣ Testing schema validation...")
try:
    test_request = AIQueryRequest(
        text="test query",
        conversation_history=[
            ConversationMessage(role="user", content="hello"),
            ConversationMessage(role="bot", content="hi there")
        ]
    )
    print(f"   ✅ Schema validation works")
    print(f"   📝 Test request: text='{test_request.text}', history={len(test_request.conversation_history)} messages")
except Exception as e:
    print(f"   ❌ Schema validation failed: {e}")
    sys.exit(1)

print("\n✅ All tests passed! Your setup looks good.")
print("\n💡 If you're still getting 500 errors, check:")
print("   - FastAPI server logs for the actual error")
print("   - Database connection (neon postgres)")
print("   - Make sure uvicorn is restarted after file changes")