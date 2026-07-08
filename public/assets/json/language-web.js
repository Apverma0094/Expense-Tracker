$(document).ready(function () {

    if($('#language-web').length > 0) {
		$('#language-web').DataTable({
			"bFilter": false, 
				"bInfo": false,
					"ordering": true,
				"autoWidth": true,
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
						"id" : 1,
						"medium" : "Web",
						"file" : "Contacts",
						"total" : "3481",
						"done" : "2861",
						"progress": "80%",
						"stage" : "1",
						"action": ""
					},
					{
						"id" : 2,
						"medium" : "Web",
						"file" : "Customers",
						"total" : "4815",
						"done" : "4815",
						"progress": "100%",
						"stage" : "0",
						"action": ""
					},
					{
						"id" : 3,
						"medium" : "Web",
						"file" : "Companies",
						"total" : "2590",
						"done" : "250",
						"progress": "5%",	
						"stage" : "3",
						"action": ""
					},
					{
						"id" : 4,
						"medium" : "Web",
						"file" : "Projects",
						"total" : "1892",
						"done" : "387",
						"progress": "40%",
						"stage" : "2",
						"action": ""
					}
			
				],
			"columns": [
				{ "data": "medium" },
				{ "render": function ( data, type, row ){
					return '<span class="black-text">'+row['file']+'</i></span>';
				}},
				{ "data": "total" },
				{ "data": "done" },
				{
					"render": function (data, type, row) {
							if(row['stage'] == "0") { var class_name = "success" } else if(row['stage'] == "1") { var class_name = "warning" } else if(row['stage'] == "2") { var class_name = "info"} else  { var class_name = "danger"}
					return '<div class="pipeline-progress d-flex align-items-center"><div class="progress"><div class="progress-bar progress-bar-'+class_name+'" role="progressbar"></div></div><span class="fw-normal text-body">'+row['progress']+'</span></div>';
					}
				}, 
				{ "render": function ( data, type, row ){
					return '<a href="language-web-edit.html" class="action-icon btn btn-xs shadow btn-icon btn-outline-light text-body"><i class="ti ti-edit text-black"></i></a>';
				}},
			]
		});
	}

});