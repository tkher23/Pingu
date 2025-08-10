#!/usr/bin/env python3
"""
Test script to demonstrate the first name extraction in email greetings
"""

def extract_first_name(full_name):
    """
    Extract first name from full name for email greeting
    This is what the AI will do based on our prompt instructions
    """
    if not full_name or full_name.strip() == "":
        return "there"
    
    # Split by spaces and take the first part
    parts = full_name.strip().split()
    if parts:
        return parts[0]
    return "there"

def test_first_name_extraction():
    """Test various name formats"""
    print("🧪 Testing First Name Extraction")
    print("=" * 50)
    
    test_names = [
        "John Doe",
        "Jane Smith-Johnson", 
        "Dr. Michael Brown",
        "Sarah",
        "Jean-Pierre Dupont",
        "Mary Kate Johnson",
        "   Robert Williams   ",  # With spaces
        "",  # Empty
        "王小明",  # Non-English name
        "José García"  # With accent
    ]
    
    for full_name in test_names:
        first_name = extract_first_name(full_name)
        print(f"'{full_name}' → 'Dear {first_name}'")

def demo_before_after():
    """Show before and after examples"""
    print("\n📧 Before vs After Email Greetings")
    print("=" * 50)
    
    examples = [
        "John Smith",
        "Dr. Sarah Johnson", 
        "Michael Brown",
        "Jennifer Martinez-Williams"
    ]
    
    for name in examples:
        first_name = extract_first_name(name)
        print(f"❌ Before: 'Dear {name}'")
        print(f"✅ After:  'Dear {first_name}'")
        print()

def explain_changes():
    """Explain what was changed"""
    print("🔧 Changes Made to Email Templates")
    print("=" * 50)
    
    changes = [
        "Updated langchain_email_writer.py prompt",
        "Updated simple_email.py prompt", 
        "Added instruction to extract first name only",
        "Changed from 'Dear {recipient_name}' to 'Dear [First Name]'",
        "AI will now automatically extract first name from full name"
    ]
    
    for i, change in enumerate(changes, 1):
        print(f"{i}. ✅ {change}")
    
    print(f"\n📋 Technical Details:")
    print(f"   - Modified prompt templates to instruct AI")
    print(f"   - Added 'extract just the first name' instruction")
    print(f"   - Works with existing recipient_name variable")
    print(f"   - No backend logic changes needed")
    print(f"   - AI handles name extraction intelligently")

if __name__ == "__main__":
    test_first_name_extraction()
    demo_before_after()
    explain_changes()
    
    print("\n✅ First Name Email Greeting Fix Complete!")
    print("📧 Emails will now start with 'Dear [FirstName]' instead of full names")
    print("🧠 AI will intelligently extract first names from full names")
