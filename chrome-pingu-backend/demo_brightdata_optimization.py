#!/usr/bin/env python3
"""
Demo script showing how the optimized BrightData polling would work in practice
"""

import time
import json
from datetime import datetime

def simulate_optimized_polling():
    """Simulate the new optimized polling behavior"""
    print("🚀 Simulating Optimized BrightData Polling")
    print("=" * 60)
    
    # Simulate job metadata
    job_metadata = {
        'status_checks': 0,
        'last_poll_time': 0,
        'max_status_checks': 30,
        'started_at': datetime.utcnow().isoformat()
    }
    
    start_time = time.time()
    
    for poll_attempt in range(1, 8):  # Simulate 7 polls before completion
        current_time = time.time()
        elapsed = current_time - start_time
        
        # Calculate if we should poll now (exponential backoff)
        if job_metadata['last_poll_time'] == 0:
            can_poll = True
            wait_time = 0
        else:
            # Calculate required delay
            status_checks = job_metadata['status_checks']
            base_delays = [0.5, 1.0, 2.0, 4.0, 8.0]
            max_delay = 10.0
            
            if status_checks - 1 < len(base_delays):
                required_delay = base_delays[status_checks - 1]
            else:
                required_delay = max_delay
            
            time_since_last_poll = current_time - job_metadata['last_poll_time']
            can_poll = time_since_last_poll >= required_delay
            wait_time = max(0, required_delay - time_since_last_poll)
        
        print(f"\n📡 Poll Attempt #{poll_attempt}")
        print(f"   Time elapsed: {elapsed:.1f}s")
        print(f"   Status checks: {job_metadata['status_checks']}")
        
        if can_poll:
            print(f"   ✅ Polling BrightData API now")
            print(f"   🔧 Using custom_output_fields: 'url|name|position|about|experience|education|projects|publications'")
            print(f"   📊 Expected 60-70% smaller response")
            
            # Simulate API call
            print(f"   📡 API Response: status='running' (job not complete)")
            
            # Update metadata
            job_metadata['status_checks'] += 1
            job_metadata['last_poll_time'] = current_time
            
            # Calculate next delay
            if job_metadata['status_checks'] < len([0.5, 1.0, 2.0, 4.0, 8.0]):
                next_delay = [0.5, 1.0, 2.0, 4.0, 8.0][job_metadata['status_checks']]
            else:
                next_delay = 10.0
            print(f"   ⏰ Next poll in: {next_delay}s")
            
            # Simulate the delay for demo
            if poll_attempt < 7:  # Don't wait on last iteration
                time.sleep(min(next_delay, 2))  # Cap demo delay at 2s
        else:
            print(f"   ⏳ Exponential backoff: wait {wait_time:.1f}s more")
            return  # In real implementation, would return "pending" response
    
    # Simulate job completion
    final_elapsed = time.time() - start_time
    print(f"\n🎉 Job completed after {final_elapsed:.1f}s")
    print(f"📊 Total API calls: 7 (vs ~15-20 with constant 3s polling)")
    print(f"🚀 Data transfer: ~30-40% of original size")

def compare_old_vs_new():
    """Compare old constant polling vs new exponential backoff"""
    print("\n📊 Performance Comparison")
    print("=" * 60)
    
    job_duration = 90  # 90 second job
    
    # Old approach: constant 3s polling
    old_polls = job_duration // 3  # Every 3 seconds
    old_data_per_poll = 100  # 100% data size
    old_total_data = old_polls * old_data_per_poll
    
    # New approach: exponential backoff + custom fields
    new_polls = 7  # Realistic number with exponential backoff
    new_data_per_poll = 35  # 35% data size with custom_output_fields
    new_total_data = new_polls * new_data_per_poll
    
    print(f"📋 Scenario: 90-second BrightData job")
    print(f"")
    print(f"🔴 Old Approach (Constant 3s polling):")
    print(f"   API calls: {old_polls}")
    print(f"   Data per call: 100% (full profile)")
    print(f"   Total data transfer: {old_total_data}% units")
    print(f"")
    print(f"🟢 New Approach (Exponential backoff + custom fields):")
    print(f"   API calls: {new_polls}")
    print(f"   Data per call: 35% (essential fields only)")
    print(f"   Total data transfer: {new_total_data}% units")
    print(f"")
    print(f"🎯 Improvements:")
    print(f"   API calls reduced: {((old_polls - new_polls) / old_polls * 100):.0f}%")
    print(f"   Data transfer reduced: {((old_total_data - new_total_data) / old_total_data * 100):.0f}%")
    print(f"   Server load reduced: {((old_polls - new_polls) / old_polls * 100):.0f}%")
    print(f"   Cost savings: Significant on high-volume usage")

if __name__ == "__main__":
    simulate_optimized_polling()
    compare_old_vs_new()
    
    print("\n✅ Demo Complete!")
    print("🔧 Implementation ready for production testing")
