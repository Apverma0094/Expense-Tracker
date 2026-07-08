$(document).ready(function () {
    if($('#growth-overview-list').length > 0) {
		$('#growth-overview-list').DataTable({
				"bFilter": false, 
				"bInfo": false,
					"ordering": true,
				"autoWidth": true,
                "paging": false,
				"language": {
					search: ' ',
					sLengthMenu: '_MENU_',
					searchPlaceholder: "Search",
					info: "_START_ - _END_ of _TOTAL_ items",
					"lengthMenu":     "Show _MENU_ entries",
					paginate: {
					next: '<i class="ti ti-chevron-right"></i> ',
					previous: '<i class="ti ti-chevron-left"></i> '
				},
					},
				initComplete: (settings, json)=>{
					$('.dataTables_paginate').appendTo('.datatable-paginate');
					$('.dataTables_length').appendTo('.datatable-length');
				},  
				"data":[
					{
						"period" : "Jan 2026",
						"income" : "Rs. 95,000",
						"expense" : "Rs. 61,500",
						"balance" : "Rs. 33,500",
						"category" : "Rent",
						"budgetUsed" : "62%",
						"status" : "Healthy"
					},
					{
						"period" : "Feb 2026",
						"income" : "Rs. 98,000",
						"expense" : "Rs. 66,200",
						"balance" : "Rs. 31,800",
						"category" : "Food",
						"budgetUsed" : "68%",
						"status" : "Healthy"
					},
					{
						"period" : "Mar 2026",
						"income" : "Rs. 1,05,000",
						"expense" : "Rs. 72,400",
						"balance" : "Rs. 32,600",
						"category" : "Travel",
						"budgetUsed" : "73%",
						"status" : "Watch"
					},
					{
						"period" : "Apr 2026",
						"income" : "Rs. 1,10,000",
						"expense" : "Rs. 76,850",
						"balance" : "Rs. 33,150",
						"category" : "Bills",
						"budgetUsed" : "77%",
						"status" : "Watch"
					},
					{
						"period" : "May 2026",
						"income" : "Rs. 1,18,000",
						"expense" : "Rs. 80,300",
						"balance" : "Rs. 37,700",
						"category" : "Shopping",
						"budgetUsed" : "74%",
						"status" : "Healthy"
					},
					{
						"period" : "Jun 2026",
						"income" : "Rs. 1,24,500",
						"expense" : "Rs. 78,340",
						"balance" : "Rs. 46,160",
						"category" : "Food",
						"budgetUsed" : "68%",
						"status" : "On Track"
					}
				],
			"columns": [
				{ "data": "period" },
				{ "data": "income" },
				{ "data": "expense" },
				{ "data": "balance" },
				{ "data": "category" },
				{ "data": "budgetUsed" },
				{ "render": function ( data, type, row ){
					var class_name = "bg-success";
					if (row.status === "Watch") class_name = "bg-warning";
					if (row.status === "Critical") class_name = "bg-danger";
					return '<span class="badge badge-pill badge-status '+class_name+'" >'+row.status+'</span>';
				}},
				
			]
				
		});
	}
});
